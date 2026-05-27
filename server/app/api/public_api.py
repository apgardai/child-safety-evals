from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import verify_session_or_secret
from app.api.internal import get_latest_evaluation_viewer_data
from app.crud.evaluation_runs import (
    append_evaluation_run_log,
    cancel_evaluation_run,
    create_evaluation_run,
    create_pending_evaluation_run,
    evaluation_run_detail_dict,
    get_active_evaluation_run_for_account,
    get_resumable_cancelled_evaluation_run_for_account,
    get_evaluation_run_for_account,
    list_evaluation_runs_for_account,
    set_evaluation_run_scenario_total,
    set_evaluation_run_status,
    summarize_run,
)
from app.services.benchmark_progress import count_scenario_test_tasks
from app.services.local_benchmark_results import (
    is_local_run_id,
    list_model_result_runs,
    load_local_run_viewer_data,
    load_model_result_viewer_data,
)
from app.services.evaluation_cancel import revoke_evaluation_celery_task
from app.schemas.evaluation_runs import (
    EvaluationRunActiveOut,
    EvaluationRunBenchmarkContextOut,
    EvaluationRunDetailOut,
    EvaluationRunStart,
    EvaluationRunStartOut,
)
from app.tasks.evaluation import run_evaluation
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
)
from app.schemas.model_registry import ModelRegistryUpsert
from app.services.database import get_db
from app.services.firebase import SESSION_COOKIE_NAME, verify_session_cookie

router = APIRouter()


def require_session_email(request: Request) -> str:
    session_email = verify_session_or_secret(request, None)
    if not session_email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session_email


def _session_domain() -> str | None:
    # Prefer SESSION_DOMAIN to match apgard-be; keep SESSION_COOKIE_DOMAIN for backwards compatibility.
    return (
        os.getenv("SESSION_DOMAIN", "").strip()
        or os.getenv("SESSION_COOKIE_DOMAIN", "").strip()
        or None
    )


@router.get("/auth/me")
def auth_me(request: Request, db: Session = Depends(get_db)):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
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


@router.post("/auth/logout")
def auth_logout(request: Request, response: Response):
    session = request.cookies.get(SESSION_COOKIE_NAME)
    if session:
        try:
            decoded = verify_session_cookie(session)
            uid = decoded.get("uid")
            if isinstance(uid, str) and uid:
                firebase_auth.revoke_refresh_tokens(uid)
        except Exception:
            pass
    session_domain = _session_domain()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value="",
        max_age=0,
        domain=session_domain,
        httponly=True,
        secure=True,
        samesite="None",
        path="/",
    )
    return {"ok": True}


@router.get("/models")
def list_models_public(request: Request, db: Session = Depends(get_db)):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    rows = list_model_registry_entries(
        db,
        account_id=user.account_id,
        created_by_user_id=user.id,
    )
    registry: dict[str, dict] = {}
    custom_models: list[str] = []
    for row in rows:
        optional = row.optional_parameters or {}
        registry[row.alias] = {
            "model": row.model_id,
            **({"maxTokens": optional.get("maxTokens")} if isinstance(optional.get("maxTokens"), (int, float)) else {}),
            **({"temperature": optional.get("temperature")} if isinstance(optional.get("temperature"), (int, float)) else {}),
            **({"providerOptions": optional.get("providerOptions")} if isinstance(optional.get("providerOptions"), dict) else {}),
        }
        if row.is_custom:
            custom_models.append(row.alias)
    return {
        "models": sorted(registry.keys()),
        "customModels": sorted(custom_models),
        "registry": registry,
    }


@router.put("/models")
def upsert_model_public(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
):
    email = require_session_email(request)
    slug = str(body.get("slug", "")).strip()
    config = body.get("config")
    if not slug or not isinstance(config, dict):
        raise HTTPException(status_code=400, detail="Body must be { slug: string, config: object }")
    model_id = str(config.get("model", "")).strip()
    if not model_id:
        raise HTTPException(status_code=400, detail="config.model must be a non-empty string")
    optional_parameters: dict = {}
    if "maxTokens" in config:
        optional_parameters["maxTokens"] = config["maxTokens"]
    if "temperature" in config:
        optional_parameters["temperature"] = config["temperature"]
    if "providerOptions" in config and isinstance(config["providerOptions"], dict):
        optional_parameters["providerOptions"] = config["providerOptions"]
    for key in ("customApiEndpoint", "customApiKey", "parsingKey"):
        if key in config and config[key] is not None:
            optional_parameters[key] = config[key]
    if slug.startswith("custom-"):
        print(
            "[cse/custom-model] upsert requested",
            {
                "alias": slug,
                "email": email,
                "has_custom_api_endpoint": bool(
                    str(config.get("customApiEndpoint", "")).strip()
                ),
                "has_custom_api_key": bool(
                    str(config.get("customApiKey", "")).strip()
                ),
                "parsing_key": str(config.get("parsingKey", "")).strip() or "message",
            },
        )
    payload = ModelRegistryUpsert(
        alias=slug,
        model_id=model_id,
        optional_parameters=optional_parameters,
        is_custom=slug.startswith("custom-"),
        custom_url=optional_parameters.get("customApiEndpoint") if slug.startswith("custom-") else None,
        custom_api_key=optional_parameters.get("customApiKey") if slug.startswith("custom-") else None,
        parsing_key=optional_parameters.get("parsingKey") if slug.startswith("custom-") else None,
        created_by_email=email,
    )
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    upsert_model_registry_entry(db, payload=payload, created_by_user=user)
    rows = list_model_registry_entries(db, account_id=user.account_id, created_by_user_id=user.id)
    return {"ok": True, "models": sorted([r.alias for r in rows])}


@router.post("/models")
def create_model_public(request: Request, body: dict, db: Session = Depends(get_db)):
    return upsert_model_public(request, body, db)


@router.delete("/models")
def delete_model_public(request: Request, body: dict, db: Session = Depends(get_db)):
    email = require_session_email(request)
    slug = str(body.get("slug", "")).strip()
    if not slug:
        raise HTTPException(status_code=400, detail="Body must be { slug: string }")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    delete_model_registry_entry(
        db,
        alias=slug,
        account_id=user.account_id,
        created_by_user_id=user.id,
    )
    rows = list_model_registry_entries(db, account_id=user.account_id, created_by_user_id=user.id)
    return {"ok": True, "models": sorted([r.alias for r in rows])}


def _prepare_custom_model_for_run(
    db: Session,
    *,
    user,
    target_model: str,
    custom_api_key: str | None,
    custom_api_endpoint: str | None,
    custom_parsing_key: str | None,
) -> None:
    if not target_model.startswith("custom-"):
        return
    key = (custom_api_key or "").strip()
    endpoint = (custom_api_endpoint or "").strip()
    if not key or not endpoint:
        cfg = get_custom_runtime_config(db, alias=target_model, account_id=user.account_id)
        if not cfg:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Custom target model requires customApiKey and customApiEndpoint, "
                    "or a saved custom model with credentials."
                ),
            )
        return
    optional_parameters: dict = {
        "customApiEndpoint": endpoint,
        "customApiKey": key,
        "parsingKey": (custom_parsing_key or "").strip() or "message",
    }
    payload = ModelRegistryUpsert(
        alias=target_model,
        model_id=target_model,
        optional_parameters=optional_parameters,
        is_custom=True,
        custom_url=endpoint,
        custom_api_key=key,
        parsing_key=optional_parameters["parsingKey"],
        created_by_email=user.email,
    )
    upsert_model_registry_entry(db, payload=payload, created_by_user=user)


@router.post("/evaluation-runs/start", response_model=EvaluationRunStartOut)
def start_evaluation_run_public(
    request: Request,
    body: EvaluationRunStart,
    db: Session = Depends(get_db),
):
    """Queue a long-running benchmark evaluation on the Celery worker."""
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_model = body.target_model.strip()
    if not target_model:
        raise HTTPException(status_code=400, detail="target_model is required")

    if target_model.startswith("custom-"):
        _prepare_custom_model_for_run(
            db,
            user=user,
            target_model=target_model,
            custom_api_key=body.custom_api_key,
            custom_api_endpoint=body.custom_api_endpoint,
            custom_parsing_key=body.custom_parsing_key,
        )
    elif not has_account_ai_gateway_api_key(db, account_id=user.account_id):
        raise HTTPException(
            status_code=400,
            detail="AI Gateway API key is required. Save it on your account before running evaluations.",
        )

    prompts = body.prompts if body.prompts else ["default"]
    run = create_pending_evaluation_run(
        db,
        user=user,
        target_model=target_model,
        judge_model=body.judge_model,
        user_model=body.user_model,
        prompts=prompts,
    )

    try:
        scenarios_total = count_scenario_test_tasks(body.input, prompts)
        set_evaluation_run_scenario_total(db, run, scenarios_total=scenarios_total)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not count scenarios in {body.input!r}: {e}",
        ) from e

    async_result = run_evaluation.delay(
        str(run.id),
        str(user.id),
        target_model=target_model,
        judge_model=body.judge_model,
        user_model=body.user_model,
        scenarios_input=body.input,
        prompts=prompts,
    )
    append_evaluation_run_log(
        db,
        run,
        f"Submitted to task queue (task id: {async_result.id}).\n",
    )
    set_evaluation_run_status(db, run, status="pending", celery_task_id=async_result.id)

    return EvaluationRunStartOut(
        id=run.id,
        status="pending",
        celery_task_id=async_result.id,
    )


@router.get("/evaluation-runs/active", response_model=EvaluationRunActiveOut)
def get_active_evaluation_run_public(
    request: Request,
    db: Session = Depends(get_db),
):
    """Return the account's in-flight evaluation (pending or running), if any."""
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = get_active_evaluation_run_for_account(db, account_id=user.account_id)
    if not run:
        return EvaluationRunActiveOut(active=False)
    detail = evaluation_run_detail_dict(run)
    return EvaluationRunActiveOut(active=True, **detail)


@router.get(
    "/evaluation-runs/benchmark-context",
    response_model=EvaluationRunBenchmarkContextOut,
)
def get_evaluation_benchmark_context_public(
    request: Request,
    db: Session = Depends(get_db),
):
    """Return in-flight and/or the latest cancelled run when it is still resumable.

    A cancelled run is resumable only with partial progress and when no evaluation run
    was created after it (e.g. a later completed run disqualifies an earlier cancel).
    """
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    account_id = user.account_id

    in_flight_run = get_active_evaluation_run_for_account(db, account_id=account_id)
    in_flight = (
        EvaluationRunDetailOut(**evaluation_run_detail_dict(in_flight_run))
        if in_flight_run
        else None
    )

    resumable = None
    if not in_flight_run:
        resumable_run = get_resumable_cancelled_evaluation_run_for_account(
            db, account_id=account_id
        )
        if resumable_run:
            resumable = EvaluationRunDetailOut(
                **evaluation_run_detail_dict(resumable_run)
            )

    return EvaluationRunBenchmarkContextOut(
        in_flight=in_flight,
        resumable=resumable,
    )


@router.post("/evaluation-runs/{evaluation_run_id}/cancel", response_model=EvaluationRunDetailOut)
def cancel_evaluation_run_public(
    request: Request,
    evaluation_run_id: UUID,
    db: Session = Depends(get_db),
):
    """Stop an in-flight evaluation and mark it cancelled."""
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = get_evaluation_run_for_account(
        db, run_id=evaluation_run_id, account_id=user.account_id
    )
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    if run.status not in ("pending", "running"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel evaluation with status {run.status!r}",
        )
    task_id = run.celery_task_id
    try:
        run = cancel_evaluation_run(db, run=run)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    revoke_evaluation_celery_task(task_id)
    return EvaluationRunDetailOut(**evaluation_run_detail_dict(run))


@router.get("/evaluation-runs/{evaluation_run_id}", response_model=EvaluationRunDetailOut)
def get_evaluation_run_public(
    request: Request,
    evaluation_run_id: UUID,
    db: Session = Depends(get_db),
):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = get_evaluation_run_for_account(
        db, run_id=evaluation_run_id, account_id=user.account_id
    )
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return EvaluationRunDetailOut(**evaluation_run_detail_dict(run))


@router.get("/evaluation-runs")
def list_runs_public(request: Request, db: Session = Depends(get_db)):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    rows = list_evaluation_runs_for_account(db, account_id=user.account_id, limit=50, offset=0)
    return {"runs": [summarize_run(r) for r in rows]}


class EvaluationRunPersistBody(BaseModel):
    results: dict[str, Any] = Field(..., description="Parsed benchmark results.json")
    viewer_data: dict[str, Any] | None = Field(
        None, description="Optional viewer-data for scenario/message persistence"
    )


@router.post("/evaluation-runs")
def persist_evaluation_run_public(
    request: Request,
    body: EvaluationRunPersistBody,
    db: Session = Depends(get_db),
):
    """Persist a completed benchmark run for the signed-in user (same as internal, without body email)."""
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    run = create_evaluation_run(
        db,
        user=user,
        results=body.results,
        viewer_data=body.viewer_data,
    )
    return {"id": str(run.id)}


@router.get("/evaluation-runs/{evaluation_run_id}/viewer-data")
def run_viewer_data_public(
    request: Request,
    evaluation_run_id: str,
    db: Session = Depends(get_db),
):
    if is_local_run_id(evaluation_run_id):
        try:
            return load_local_run_viewer_data(evaluation_run_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    email = require_session_email(request)
    try:
        run_uuid = UUID(evaluation_run_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid evaluation run id.") from exc
    return get_latest_evaluation_viewer_data(
        request=request,
        email=email,
        run_id=run_uuid,
        x_internal_secret=None,
        db=db,
    )


@router.get("/scenarios/viewer-data")
def scenarios_viewer_data_public(request: Request, db: Session = Depends(get_db)):
    email = require_session_email(request)
    return get_latest_evaluation_viewer_data(
        request=request,
        email=email,
        run_id=None,
        x_internal_secret=None,
        db=db,
    )


@router.get("/model-results")
def list_model_results_public():
    """Leaderboard rows from ``benchmark/data/model-results/*/results.json``."""
    return {"runs": list_model_result_runs()}


@router.get("/model-results/viewer-data")
def model_result_viewer_data_query_public(
    model_id: str | None = None,
    runId: str | None = None,
):
    """Viewer data by ``model_id`` (preferred) or legacy ``local-model-{id}`` runId."""
    try:
        if model_id and model_id.strip():
            return load_model_result_viewer_data(model_id.strip())
        if runId and runId.strip():
            if not is_local_run_id(runId):
                raise HTTPException(status_code=400, detail="Invalid local run id.")
            return load_local_run_viewer_data(runId)
        raise HTTPException(
            status_code=400,
            detail="Provide model_id or runId query parameter.",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/model-results/{model_dir}/viewer-data")
def model_result_viewer_data_public(model_dir: str):
    """Scenario-level assessments for a filesystem model run."""
    try:
        return load_model_result_viewer_data(model_dir)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/account/ai-gateway-key")
def ai_gateway_status_public(request: Request, db: Session = Depends(get_db)):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"has_key": has_account_ai_gateway_api_key(db, account_id=user.account_id)}


@router.put("/account/ai-gateway-key")
def ai_gateway_put_public(request: Request, body: dict, db: Session = Depends(get_db)):
    email = require_session_email(request)
    api_key = str(body.get("apiKey", "")).strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="apiKey is required")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    set_account_ai_gateway_api_key(db, account_id=user.account_id, api_key=api_key)
    return {"ok": True}


@router.get("/account/ai-gateway-key/runtime")
def ai_gateway_runtime_public(request: Request, db: Session = Depends(get_db)):
    """Return decrypted AI Gateway API key for the signed-in account (benchmark CLI on Next)."""
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    api_key = get_account_ai_gateway_api_key(db, account_id=user.account_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="AI Gateway API key not found")
    return {"api_key": api_key}


@router.get("/models/{alias}/runtime-config")
def model_runtime_config_public(
    request: Request,
    alias: str,
    db: Session = Depends(get_db),
):
    email = require_session_email(request)
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    cfg = get_custom_runtime_config(db, alias=alias, account_id=user.account_id)
    if not cfg:
        print(
            "[cse/custom-model] runtime-config missing",
            {
                "alias": alias,
                "email": email,
                "account_id": str(user.account_id),
            },
        )
        raise HTTPException(status_code=404, detail="Custom model runtime config not found")
    print(
        "[cse/custom-model] runtime-config loaded",
        {
            "alias": alias,
            "email": email,
            "account_id": str(user.account_id),
            "custom_url": cfg.get("custom_url"),
            "parsing_key": cfg.get("parsing_key"),
            "has_custom_api_key": bool(cfg.get("custom_api_key")),
        },
    )
    return cfg
