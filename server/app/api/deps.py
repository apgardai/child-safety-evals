"""Internal API auth: Firebase session cookie, ID token, or shared secret (legacy)."""

from __future__ import annotations

import os

from fastapi import HTTPException, Request

from app.services.firebase import SESSION_COOKIE_NAME, verify_id_token, verify_session_cookie


def internal_secret_ok(x_internal_secret: str | None) -> bool:
    expected = os.environ.get("INTERNAL_API_SECRET")
    return bool(expected and x_internal_secret == expected)


def verify_session_or_secret(request: Request, x_internal_secret: str | None) -> str | None:
    """
    Returns normalized session email if authenticated via `cse_session` cookie.
    Returns None if authenticated via `X-Internal-Secret` (caller uses query/body email).
    Raises 401 if neither is valid.
    """
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie:
        try:
            decoded = verify_session_cookie(cookie)
            email = decoded.get("email")
            if isinstance(email, str) and email.strip():
                return email.strip().lower()
        except Exception:
            pass
    if internal_secret_ok(x_internal_secret):
        return None
    raise HTTPException(status_code=401, detail="Unauthorized")


def require_email_matches_session(
    request: Request,
    email: str,
    x_internal_secret: str | None,
) -> str:
    """Normalize email; forbid query email mismatch when using session cookie."""
    normalized = email.lower().strip()
    session_email = verify_session_or_secret(request, x_internal_secret)
    if session_email is not None:
        if session_email != normalized:
            raise HTTPException(
                status_code=403,
                detail="Email does not match signed-in session",
            )
    return normalized


def verify_sync_user(
    body_email: str,
    authorization: str | None,
    x_internal_secret: str | None,
) -> None:
    """POST /sync-user: Bearer ID token (preferred) or internal secret."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Empty bearer token")
        try:
            decoded = verify_id_token(token)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid ID token: {e}") from e
        token_email = decoded.get("email")
        if not token_email or str(token_email).lower().strip() != body_email.lower().strip():
            raise HTTPException(status_code=403, detail="Token email does not match body")
        return
    if internal_secret_ok(x_internal_secret):
        return
    raise HTTPException(status_code=401, detail="Unauthorized")
