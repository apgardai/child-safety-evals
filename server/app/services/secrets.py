import os

from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    key = os.environ.get("CSE_SECRETS_KEY", "").strip()
    if not key:
        raise ValueError("CSE_SECRETS_KEY is not configured")
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError("CSE_SECRETS_KEY is invalid for Fernet") from exc


def encrypt_api_key(plaintext: str) -> str:
    f = _get_fernet()
    token = f.encrypt(plaintext.encode("utf-8")).decode("utf-8")
    return f"enc:v1:{token}"


def decrypt_api_key(ciphertext: str) -> str:
    if not ciphertext.startswith("enc:v1:"):
        raise ValueError("Stored key is not encrypted with supported format")
    token = ciphertext.removeprefix("enc:v1:")
    f = _get_fernet()
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored key cannot be decrypted") from exc
