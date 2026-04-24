from __future__ import annotations

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
    create_evaluation_run,
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
    session_domain = os.getenv("SESSION_COOKIE_DOMAIN", "").strip()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value="",
        max_age=0,
        domain=session_domain or None,
        httponly=True,
        secure=os.getenv("NODE_ENV", "development") == "production",
        samesite="none",
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
    evaluation_run_id: UUID,
    db: Session = Depends(get_db),
):
    email = require_session_email(request)
    return get_latest_evaluation_viewer_data(
        request=request,
        email=email,
        run_id=evaluation_run_id,
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
        raise HTTPException(status_code=404, detail="Custom model runtime config not found")
    return cfg
