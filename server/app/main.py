import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import app.models  # noqa: F401 — register SQLAlchemy models on Base.metadata
from app.api.auth import router as auth_router
from app.api.internal import router as internal_router
from app.api.public_api import router as public_api_router
from app.services.database import Base, engine
from app.services.firebase import init_firebase


def _ensure_backwards_compatible_schema() -> None:
    """
    This project currently uses create_all (no Alembic). Additive ALTERs here keep
    existing local DBs compatible with newer ORM models.
    """
    ddl = [
        # cse_models
        "ALTER TABLE IF EXISTS cse_models ADD COLUMN IF NOT EXISTS account_id UUID",
        # cse_accounts
        "ALTER TABLE IF EXISTS cse_accounts ADD COLUMN IF NOT EXISTS ai_gateway_api_key VARCHAR",
        # cse_evaluation_runs
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS target_model_id UUID",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS target_model_name VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'completed'",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS celery_task_id VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS progress_log TEXT",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS scenarios_completed INTEGER",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ADD COLUMN IF NOT EXISTS scenarios_total INTEGER",
        "ALTER TABLE IF EXISTS cse_evaluation_runs ALTER COLUMN results_json DROP NOT NULL",
        # cse_conversations
        "ALTER TABLE IF EXISTS cse_conversations ADD COLUMN IF NOT EXISTS evaluation_run_id UUID",
        # cse_assessments
        "ALTER TABLE IF EXISTS cse_assessments ADD COLUMN IF NOT EXISTS age_range VARCHAR",
        "ALTER TABLE IF EXISTS cse_assessments ADD COLUMN IF NOT EXISTS prompt_variant VARCHAR",
        "ALTER TABLE IF EXISTS cse_assessments ADD COLUMN IF NOT EXISTS safety_grade VARCHAR",
        "ALTER TABLE IF EXISTS cse_assessments ADD COLUMN IF NOT EXISTS assessment_reasons TEXT",
        # cse_evaluation_scenarios
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS scenario_external_id VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS conversation_id UUID",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS scenario_title VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS prompt_variant VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS age_range VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS safety_grade VARCHAR",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS assessment_reasons TEXT",
        "ALTER TABLE IF EXISTS cse_evaluation_scenarios ADD COLUMN IF NOT EXISTS narrative TEXT",
    ]
    with engine.begin() as conn:
        for stmt in ddl:
            conn.execute(text(stmt))
        # Remove deprecated column now that runs are DB-only.
        conn.execute(
            text("ALTER TABLE IF EXISTS cse_evaluation_runs DROP COLUMN IF EXISTS output_relpath")
        )
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS cse_evaluation_scenarios DROP COLUMN IF EXISTS scenario_summary"
            )
        )
        conn.execute(
            text("ALTER TABLE IF EXISTS cse_assessments DROP COLUMN IF EXISTS summary")
        )
        # Ensure run -> conversations uses ON DELETE CASCADE, so deleting runs removes
        # child conversations (and their messages) at DB level.
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ix_cse_evaluation_runs_one_active_per_account
                ON cse_evaluation_runs (account_id)
                WHERE status IN ('pending', 'running')
                """
            )
        )
        conn.execute(
            text(
                """
                DO $$
                DECLARE
                  fk_name text;
                BEGIN
                  SELECT c.conname
                  INTO fk_name
                  FROM pg_constraint c
                  JOIN pg_class t ON t.oid = c.conrelid
                  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
                  WHERE t.relname = 'cse_conversations'
                    AND c.contype = 'f'
                    AND a.attname = 'evaluation_run_id'
                  LIMIT 1;

                  IF fk_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE cse_conversations DROP CONSTRAINT %I', fk_name);
                  END IF;

                  ALTER TABLE cse_conversations
                    ADD CONSTRAINT cse_conversations_evaluation_run_id_fkey
                    FOREIGN KEY (evaluation_run_id)
                    REFERENCES cse_evaluation_runs(id)
                    ON DELETE CASCADE;
                EXCEPTION
                  WHEN duplicate_object THEN
                    NULL;
                END $$;
                """
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_firebase()
    Base.metadata.create_all(bind=engine)
    _ensure_backwards_compatible_schema()
    yield


def _cors_origins() -> list[str]:
    defaults = [
        "https://benchmark.apgardai.com",
        "http://localhost:3000",
    ]
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return defaults
    custom = [s.strip().rstrip("/") for s in raw.split(",") if s.strip()]
    return custom or defaults


app = FastAPI(title="Child Safety AI Evaluation API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Internal routes: Firebase session cookie (forwarded from Next) or legacy X-Internal-Secret.
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(public_api_router, prefix="/api", tags=["api"])

app.include_router(internal_router, prefix="/internal", tags=["internal"])


@app.get("/")
def root():
    return {
        "service": "child-safety-evals-api",
        "docs": "/docs",
        "health": "/internal/health",
    }
