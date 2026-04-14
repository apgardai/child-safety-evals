#!/usr/bin/env python3
"""Import benchmark/models.json entries into cse_models."""

from __future__ import annotations

import json
from pathlib import Path
import sys

from sqlalchemy import text

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.crud.model_registry import upsert_model_registry_entry
from app.schemas.model_registry import ModelRegistryUpsert
from app.services.database import SessionLocal


def _benchmark_models_path() -> Path:
    return Path(__file__).resolve().parents[2] / "benchmark" / "models.json"


def _ensure_cse_models_shape() -> None:
    """
    Keep table compatible when models evolve but no Alembic is used.
    """
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                ALTER TABLE cse_models
                ADD COLUMN IF NOT EXISTS account_id UUID
                """
            )
        )
        db.commit()
    finally:
        db.close()


def main() -> int:
    _ensure_cse_models_shape()
    models_path = _benchmark_models_path()
    if not models_path.exists():
        raise FileNotFoundError(f"models.json not found: {models_path}")

    payload = json.loads(models_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("models.json must be a JSON object of alias -> config")

    upserted = 0
    db = SessionLocal()
    try:
        for alias, config in payload.items():
            if not isinstance(alias, str) or not alias.strip():
                continue
            if not isinstance(config, dict):
                continue
            model_id = config.get("model")
            if not isinstance(model_id, str) or not model_id.strip():
                continue

            optional_parameters = {
                k: v for k, v in config.items() if k not in {"model"}
            } or None
            row = upsert_model_registry_entry(
                db,
                payload=ModelRegistryUpsert(
                    alias=alias.strip(),
                    model_id=model_id.strip(),
                    optional_parameters=optional_parameters,
                    is_custom=False,
                ),
            )
            upserted += 1
            print(f"upserted: {row.alias} -> {row.model_id}")
    finally:
        db.close()

    print(f"done. upserted {upserted} model rows from {models_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
