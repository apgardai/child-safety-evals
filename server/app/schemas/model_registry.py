from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ModelRegistryUpsert(BaseModel):
    alias: str = Field(min_length=1)
    model_id: str = Field(min_length=1)
    optional_parameters: dict[str, Any] | None = None
    is_custom: bool = False
    custom_url: str | None = None
    custom_api_key: str | None = None
    parsing_key: str | None = None
    created_by_email: str | None = None


class ModelRegistryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    alias: str
    model_id: str
    optional_parameters: dict[str, Any] | None = None
    is_custom: bool
    custom_url: str | None = None
    parsing_key: str | None = None
    account_id: UUID | None = None
    created_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
