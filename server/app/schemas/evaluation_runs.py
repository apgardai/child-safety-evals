from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EvaluationRunStart(BaseModel):
    target_model: str = Field(..., min_length=1)
    judge_model: str = "gpt-5.2:high:limited"
    user_model: str = "deepseek-v3.2"
    input: str = "data/scenarios.jsonl"
    prompts: list[str] | None = None
    custom_api_key: str | None = None
    custom_api_endpoint: str | None = None
    custom_parsing_key: str | None = None


class EvaluationRunStartOut(BaseModel):
    id: UUID
    status: str
    celery_task_id: str | None = None


class EvaluationRunCreate(BaseModel):
    """Full benchmark CLI results document (typically `data/results.json`)."""

    email: EmailStr
    results: dict[str, Any] = Field(..., description="Parsed results.json object")
    viewer_data: dict[str, Any] | None = Field(
        None,
        description="Optional viewer-data payload containing scenarios/messages for persistence",
    )


class EvaluationRunSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    status: str = "completed"
    target_model: str | None
    judge_model: str | None
    user_model: str | None
    prompts: list[str] | None = None
    num_scores: int = 0
    overall_score_pct: float | None = None
    error_message: str | None = None
    progress_log: str | None = None
    scenarios_completed: int | None = None
    scenarios_total: int | None = None


class EvaluationRunDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    status: str = "completed"
    target_model: str | None
    judge_model: str | None
    user_model: str | None
    prompts: list[str] | None = None
    error_message: str | None = None
    progress_log: str | None = None
    celery_task_id: str | None = None
    scenarios_completed: int | None = None
    scenarios_total: int | None = None
    results: dict[str, Any] | None = None


class EvaluationRunBenchmarkContextOut(BaseModel):
    """In-flight and resumable runs for the benchmark page (account-scoped)."""

    in_flight: EvaluationRunDetailOut | None = None
    resumable: EvaluationRunDetailOut | None = None


class EvaluationRunActiveOut(BaseModel):
    active: bool
    id: UUID | None = None
    status: str | None = None
    created_at: datetime | None = None
    target_model: str | None = None
    judge_model: str | None = None
    user_model: str | None = None
    prompts: list[str] | None = None
    error_message: str | None = None
    progress_log: str | None = None
    celery_task_id: str | None = None
    scenarios_completed: int | None = None
    scenarios_total: int | None = None
