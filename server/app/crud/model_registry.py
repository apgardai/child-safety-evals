from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.model_registry import ModelRegistryEntry
from app.models.user import User
from app.schemas.model_registry import ModelRegistryUpsert
from app.services.secrets import decrypt_api_key, encrypt_api_key


def upsert_model_registry_entry(
    db: Session,
    *,
    payload: ModelRegistryUpsert,
    created_by_user: User | None = None,
) -> ModelRegistryEntry:
    alias = payload.alias.strip()
    model_id = payload.model_id.strip()
    row = db.query(ModelRegistryEntry).filter(ModelRegistryEntry.alias == alias).first()
    if row is None:
        row = ModelRegistryEntry(alias=alias, model_id=model_id)
        db.add(row)

    row.model_id = model_id
    row.optional_parameters = payload.optional_parameters
    row.is_custom = payload.is_custom
    row.custom_url = payload.custom_url.strip() if payload.custom_url else None
    row.custom_api_key = (
        encrypt_api_key(payload.custom_api_key.strip()) if payload.custom_api_key else None
    )
    row.parsing_key = payload.parsing_key.strip() if payload.parsing_key else None
    if payload.is_custom:
        if created_by_user is None:
            raise ValueError("Custom models require created_by_user for account scoping")
        row.created_by_user_id = created_by_user.id
        row.account_id = created_by_user.account_id
    else:
        if created_by_user:
            row.created_by_user_id = created_by_user.id
        row.account_id = None

    db.commit()
    db.refresh(row)
    return row


def list_model_registry_entries(
    db: Session,
    *,
    account_id=None,
    created_by_user_id=None,
) -> list[ModelRegistryEntry]:
    q = db.query(ModelRegistryEntry)
    if account_id is not None or created_by_user_id is not None:
        custom_scope_filters = []
        if account_id is not None:
            custom_scope_filters.append(ModelRegistryEntry.account_id == account_id)
        if created_by_user_id is not None:
            custom_scope_filters.append(ModelRegistryEntry.created_by_user_id == created_by_user_id)
        q = q.filter(
            or_(
                ModelRegistryEntry.is_custom.is_(False),
                or_(*custom_scope_filters),
            )
        )
    return q.order_by(ModelRegistryEntry.alias.asc()).all()


def delete_model_registry_entry(
    db: Session,
    *,
    alias: str,
    account_id=None,
    created_by_user_id=None,
) -> bool:
    row = db.query(ModelRegistryEntry).filter(ModelRegistryEntry.alias == alias.strip()).first()
    if row is None:
        return False
    if row.is_custom:
        allowed = False
        if account_id is not None and row.account_id == account_id:
            allowed = True
        if created_by_user_id is not None and row.created_by_user_id == created_by_user_id:
            allowed = True
        if not allowed:
            return False
    db.delete(row)
    db.commit()
    return True


def get_model_registry_entry_for_account(
    db: Session,
    *,
    alias: str,
    account_id,
) -> ModelRegistryEntry | None:
    row = db.query(ModelRegistryEntry).filter(ModelRegistryEntry.alias == alias.strip()).first()
    if row is None:
        return None
    if row.is_custom and row.account_id != account_id:
        return None
    return row


def get_custom_runtime_config(
    db: Session,
    *,
    alias: str,
    account_id,
) -> dict[str, str] | None:
    row = get_model_registry_entry_for_account(db, alias=alias, account_id=account_id)
    if row is None or not row.is_custom:
        return None
    if not row.custom_url or not row.custom_api_key:
        return None
    return {
        "custom_url": row.custom_url,
        "custom_api_key": decrypt_api_key(row.custom_api_key),
        "parsing_key": row.parsing_key or "message",
    }
