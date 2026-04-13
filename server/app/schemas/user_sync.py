from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SyncUserRequest(BaseModel):
    firebase_uid: str = Field(min_length=1)
    email: EmailStr
    name: str = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    firebase_id: str | None
    account_id: UUID


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    domain: str | None


class MeResponse(BaseModel):
    user: UserOut
    account: AccountOut
