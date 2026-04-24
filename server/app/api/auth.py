from __future__ import annotations

import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.crud.users import sync_user_from_firebase
from app.services.database import get_db
from app.services.firebase import SESSION_COOKIE_NAME, verify_id_token

router = APIRouter()


class SessionLoginRequest(BaseModel):
    token: str = Field(min_length=1)
    name: str = ""


def _parse_allowed_emails() -> set[str] | None:
    raw = os.getenv("ALLOWED_EMAILS", "").strip()
    if not raw:
        return None
    parts = [s.strip().lower() for s in raw.split(",") if s.strip()]
    return set(parts) if parts else None


def _send_login_notification(email: str) -> None:
    """
    Optional best-effort email notification.
    Requires GMAIL_EMAIL + GMAIL_PASSWORD. Disabled when missing.
    """
    sender = os.getenv("GMAIL_EMAIL", "").strip()
    password = os.getenv("GMAIL_PASSWORD", "").strip()
    if not sender or not password:
        return

    import smtplib
    from email.mime.text import MIMEText

    recipient = os.getenv("LOGIN_NOTIFY_RECIPIENT", "ariel@apgardai.com").strip()
    msg = MIMEText(f"User logged in to child-safety-evals/ui: {email}")
    msg["Subject"] = f"Child Safety UI login: {email}"
    msg["From"] = sender
    msg["To"] = recipient

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, password)
        server.sendmail(sender, recipient, msg.as_string())


@router.post("/session-login")
def session_login(
    body: SessionLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing token")

    try:
        decoded = verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid ID token")

    email_raw = decoded.get("email")
    if not isinstance(email_raw, str) or not email_raw.strip():
        raise HTTPException(
            status_code=400,
            detail="Email claim missing on token (enable email provider / verified email)",
        )
    email = email_raw.strip().lower()

    allowed = _parse_allowed_emails()
    if allowed and email not in allowed:
        raise HTTPException(status_code=403, detail="Email not allowed")

    firebase_uid = decoded.get("uid")
    if not isinstance(firebase_uid, str) or not firebase_uid.strip():
        raise HTTPException(status_code=401, detail="Invalid ID token")

    display_name = body.name.strip() if isinstance(body.name, str) else ""
    user = sync_user_from_firebase(
        db,
        email=email,
        firebase_uid=firebase_uid,
        display_name=display_name,
    )

    expires_in = timedelta(days=5)
    try:
        session_cookie = firebase_auth.create_session_cookie(token, expires_in=expires_in)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not create session")

    session_domain = os.getenv("SESSION_COOKIE_DOMAIN", "").strip()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_cookie,
        max_age=int(expires_in.total_seconds()),
        domain=session_domain or None,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )

    try:
        _send_login_notification(email)
    except Exception:
        # Never block login on mail delivery issues.
        pass

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "accountId": str(user.account_id),
        }
    }
