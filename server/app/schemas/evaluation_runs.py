from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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
    target_model: str | None
    judge_model: str | None
    user_model: str | None
    prompts: list[str] | None = None
    num_scores: int = 0


class EvaluationRunDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    target_model: str | None
    judge_model: str | None
    user_model: str | None
    prompts: list[str] | None = None
    results: dict[str, Any]
