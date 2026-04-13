import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.users import get_user_by_email, sync_user_from_firebase
from app.schemas.user_sync import AccountOut, MeResponse, SyncUserRequest, UserOut
from app.services.database import get_db

router = APIRouter()


def _verify_internal_secret(x_internal_secret: str | None) -> None:
    expected = os.environ.get("INTERNAL_API_SECRET")
    if not expected:
        raise HTTPException(status_code=503, detail="Server misconfigured: INTERNAL_API_SECRET")
    if not x_internal_secret or x_internal_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post("/sync-user")
def sync_user(
    body: SyncUserRequest,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    """Called from the Next.js server after Firebase ID token verification (never from the browser)."""
    _verify_internal_secret(x_internal_secret)
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
    email: str = Query(..., min_length=3),
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db),
):
    _verify_internal_secret(x_internal_secret)
    normalized = email.lower().strip()
    user = get_user_by_email(db, normalized)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    acc = user.account
    return MeResponse(
        user=UserOut.model_validate(user),
        account=AccountOut.model_validate(acc),
    )


@router.get("/health")
def health(db: Session = Depends(get_db)):
    from app.services.database import check_db_connection

    ok = check_db_connection()
    if not ok:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}
