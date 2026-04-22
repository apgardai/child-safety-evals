from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    internal_secret_ok,
    require_email_matches_session,
    verify_session_or_secret,
    verify_sync_user,
)
from app.crud.evaluation_runs import (
    aggregate_safety_scores_from_scenarios,
    create_evaluation_run,
    get_evaluation_run_for_account,
    list_evaluation_runs_for_account,
    summarize_run,
)
from app.crud.model_registry import (
    delete_model_registry_entry,
    get_custom_runtime_config,
    list_model_registry_entries,
    upsert_model_registry_entry,
)
from app.crud.users import (
    get_account_ai_gateway_api_key,
    get_user_by_email,
    has_account_ai_gateway_api_key,
    set_account_ai_gateway_api_key,
    sync_user_from_firebase,
)
from app.models.evaluation_run import EvaluationRun
from app.models.evaluation_scenario import EvaluationScenario
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.schemas.evaluation_runs import (
    EvaluationRunCreate,
    EvaluationRunDetailOut,
    EvaluationRunSummaryOut,
)
from app.schemas.model_registry import ModelRegistryOut, ModelRegistryUpsert
from app.schemas.user_sync import (
    AccountOut,
    AccountGatewayKeyUpsert,
    MeResponse,
    SyncUserRequest,
    UserOut,
)
from app.services.database import get_db

router = APIRouter()


@router.post("/sync-user")
def sync_user(
    body: SyncUserRequest,
    authorization: str | None = Header(None),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    """Called from Next.js after Firebase ID token verification. Bearer ID token or internal secret."""
    verify_sync_user(body.email, authorization, x_internal_secret)
    user = sync_user_from_firebase(
        db,
        email=body.email,
        firebase_uid=body.firebase_uid,
        display_name=body.name or "",
    )
    acc = user.account
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "firebase_uid": user.firebase_id,
            "account_id": str(user.account_id),
        },
        "account": {
            "id": str(acc.id),
            "name": acc.name,
            "domain": acc.domain,
        },
    }


@router.get("/users/me", response_model=MeResponse)
def get_me(
    request: Request,
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    acc = user.account
    return MeResponse(
        user=UserOut.model_validate(user),
        account=AccountOut.model_validate(acc),
    )


@router.post("/evaluation-runs")
def create_evaluation_run_endpoint(
    request: Request,
    body: EvaluationRunCreate,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    """Persist a benchmark `results.json` document for the user's account."""
    _ = require_email_matches_session(request, body.email, x_internal_secret)
    user = get_user_by_email(db, body.email.lower().strip())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = create_evaluation_run(
        db,
        user=user,
        results=body.results,
        viewer_data=body.viewer_data,
    )
    return {"id": str(run.id)}


@router.get("/evaluation-runs", response_model=list[EvaluationRunSummaryOut])
def list_evaluation_runs_endpoint(
    request: Request,
    email: str = Query(..., min_length=3),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    rows = list_evaluation_runs_for_account(
        db, account_id=user.account_id, limit=limit, offset=offset
    )
    return [EvaluationRunSummaryOut(**summarize_run(r)) for r in rows]


@router.get("/evaluation-runs/{run_id}", response_model=EvaluationRunDetailOut)
def get_evaluation_run_endpoint(
    request: Request,
    run_id: UUID,
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = get_evaluation_run_for_account(db, run_id=run_id, account_id=user.account_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    payload = run.results_json if isinstance(run.results_json, dict) else {}
    prompts = run.prompts
    if prompts is None and isinstance(payload.get("prompts"), list):
        prompts = [str(p) for p in payload["prompts"]]
    return EvaluationRunDetailOut(
        id=run.id,
        created_at=run.created_at,
        target_model=run.target_model_name,
        judge_model=run.judge_model,
        user_model=run.user_model,
        prompts=prompts,
        results=payload,
    )


@router.get("/evaluation-runs/latest/viewer-data")
def get_latest_evaluation_viewer_data(
    request: Request,
    email: str = Query(..., min_length=3),
    run_id: UUID | None = Query(None),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    """
    Build ViewerData-compatible JSON from DB tables only.
    """
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    q = db.query(EvaluationRun).filter(EvaluationRun.account_id == user.account_id)
    if run_id:
        q = q.filter(EvaluationRun.id == run_id)
    run = q.order_by(EvaluationRun.created_at.desc()).first()
    if not run:
        raise HTTPException(status_code=404, detail="No evaluation runs found")

    payload = run.results_json if isinstance(run.results_json, dict) else {}
    scores = payload.get("scores")
    if not isinstance(scores, list):
        scores = []

    scenario_rows = (
        db.query(EvaluationScenario)
        .options(joinedload(EvaluationScenario.assessment))
        .filter(EvaluationScenario.evaluation_run_id == run.id)
        .order_by(EvaluationScenario.created_at.asc())
        .all()
    )
    if len(scores) == 0 and scenario_rows:
        scores = aggregate_safety_scores_from_scenarios(scenario_rows)
    convo_rows = (
        db.query(Conversation)
        .filter(Conversation.evaluation_run_id == run.id)
        .order_by(Conversation.created_at.asc())
        .all()
    )
    convo_ids = [c.id for c in convo_rows]
    message_rows = []
    if convo_ids:
        message_rows = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id.in_(convo_ids))
            .order_by(ConversationMessage.conversation_id.asc(), ConversationMessage.turn_index.asc())
            .all()
        )
    messages_by_convo: dict[UUID, list[dict[str, str]]] = {}
    for m in message_rows:
        bucket = messages_by_convo.setdefault(m.conversation_id, [])
        bucket.append({"role": m.role, "content": m.content})
    convo_by_id = {c.id: c for c in convo_rows}

    scenarios = []
    for idx, s in enumerate(scenario_rows):
        convo = convo_by_id.get(s.conversation_id) if s.conversation_id else None
        a = s.assessment
        grade = s.safety_grade or (a.safety_grade if a else None)
        reasons = s.assessment_reasons or (a.assessment_reasons if a else None) or ""
        scenarios.append(
            {
                "id": s.scenario_external_id or str(s.id),
                "scenarioTitle": s.scenario_title or (s.narrative[:120] if s.narrative else f"Scenario {idx + 1}"),
                "riskCategoryId": s.risk_category or "unknown",
                "riskId": s.sub_risk or "unknown",
                "ageRange": s.age_range,
                "prompt": s.prompt_variant,
                "safetyGrade": (grade or "N/A"),
                "assessmentReasons": reasons,
                "narrative": s.narrative or "",
                "messages": messages_by_convo.get(convo.id, []) if convo else [],
            }
        )

    return {
        "generatedAt": run.created_at.isoformat(),
        "summary": {
            "target": run.target_model_name or payload.get("target"),
            "judge": run.judge_model or payload.get("judge"),
            "user": run.user_model or payload.get("user"),
            "prompts": run.prompts or payload.get("prompts") or [],
            "scores": scores,
        },
        "scenarios": scenarios,
    }


@router.get("/health")
def health(db: Session = Depends(get_db)):
    from app.services.database import check_db_connection

    ok = check_db_connection()
    if not ok:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


@router.get("/models", response_model=list[ModelRegistryOut])
def list_models(
    request: Request,
    email: str | None = Query(None),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    if email:
        normalized = require_email_matches_session(request, email, x_internal_secret)
        user = get_user_by_email(db, normalized)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        rows = list_model_registry_entries(
            db,
            account_id=user.account_id,
            created_by_user_id=user.id,
        )
    else:
        if not internal_secret_ok(x_internal_secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        rows = list_model_registry_entries(db, account_id=None)
    out = []
    for row in rows:
        obj = ModelRegistryOut.model_validate(row).model_dump()
        out.append(obj)
    return out


@router.post("/models", response_model=ModelRegistryOut)
def upsert_model(
    request: Request,
    body: ModelRegistryUpsert,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    if body.created_by_email:
        require_email_matches_session(request, body.created_by_email, x_internal_secret)
    else:
        verify_session_or_secret(request, x_internal_secret)
    created_by_user = None
    if body.created_by_email:
        created_by_user = get_user_by_email(db, body.created_by_email)
    return upsert_model_registry_entry(db, payload=body, created_by_user=created_by_user)


@router.delete("/models/{alias}")
def delete_model(
    request: Request,
    alias: str,
    email: str | None = Query(None),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    if email:
        normalized = require_email_matches_session(request, email, x_internal_secret)
        user = get_user_by_email(db, normalized)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        account_id = user.account_id
        created_by_user_id = user.id
    else:
        if not internal_secret_ok(x_internal_secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        account_id = None
        created_by_user_id = None
    deleted = delete_model_registry_entry(
        db,
        alias=alias,
        account_id=account_id,
        created_by_user_id=created_by_user_id,
    )
    return {"ok": True, "deleted": deleted}


@router.put("/accounts/ai-gateway-key")
def upsert_account_ai_gateway_key(
    request: Request,
    body: AccountGatewayKeyUpsert,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _ = require_email_matches_session(request, body.email, x_internal_secret)
    user = get_user_by_email(db, body.email.lower().strip())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    set_account_ai_gateway_api_key(
        db,
        account_id=user.account_id,
        api_key=body.api_key,
    )
    return {"ok": True}


@router.get("/accounts/ai-gateway-key/status")
def get_account_ai_gateway_key_status(
    request: Request,
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"has_key": has_account_ai_gateway_api_key(db, account_id=user.account_id)}


@router.get("/accounts/ai-gateway-key/runtime")
def get_account_ai_gateway_key_runtime(
    request: Request,
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    api_key = get_account_ai_gateway_api_key(db, account_id=user.account_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="AI Gateway API key not found")
    return {"api_key": api_key}


@router.get("/models/{alias}/runtime-config")
def get_model_runtime_config(
    request: Request,
    alias: str,
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    normalized = require_email_matches_session(request, email, x_internal_secret)
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    cfg = get_custom_runtime_config(db, alias=alias, account_id=user.account_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Custom model runtime config not found")
    return cfg
