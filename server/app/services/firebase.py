"""Firebase Admin SDK — session cookies and ID tokens (aligned with Next.js `cse_session`)."""

from __future__ import annotations

import os
from pathlib import Path

from firebase_admin import auth, credentials, get_app, initialize_app

# Must match `SESSION_COOKIE_NAME` in `ui/src/lib/session-cookie-name.ts`
SESSION_COOKIE_NAME = "cse_session"


def _default_creds_path() -> Path:
    """Resolve Firebase service account JSON for local dev and Docker (/app)."""
    server_root = Path(__file__).resolve().parents[2]
    monorepo_root = Path(__file__).resolve().parents[3]
    for candidate in (
        server_root / "firebase-credentials.json",
        Path("/app/firebase-credentials.json"),
        monorepo_root / "apgard-safe-online-firebase-adminsdk-fbsvc-d4f5701c1a.json",
    ):
        if candidate.is_file():
            return candidate
    return server_root / "firebase-credentials.json"


def init_firebase() -> None:
    try:
        get_app()
    except ValueError:
        raw = os.environ.get("FIREBASE_CREDS_PATH", "").strip()
        creds_path = Path(raw) if raw else _default_creds_path()
        if not creds_path.is_file():
            raise ValueError(
                f"Firebase credentials not found at {creds_path}. "
                "Set FIREBASE_CREDS_PATH or place the service account JSON at the default path."
            )
        cred = credentials.Certificate(str(creds_path))
        initialize_app(cred)


def verify_session_cookie(cookie: str) -> dict:
    return auth.verify_session_cookie(cookie, check_revoked=True)


def verify_id_token(token: str) -> dict:
    return auth.verify_id_token(token, check_revoked=True)
