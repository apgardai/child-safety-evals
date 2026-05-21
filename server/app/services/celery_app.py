import os
from pathlib import Path

from celery import Celery
from dotenv import load_dotenv

_server_root = Path(__file__).resolve().parents[2]
load_dotenv(_server_root / ".env")


def _resolve_redis_url(env_key: str, default: str) -> str:
    raw = os.getenv(env_key, default).strip() or default
    # Compose service hostname "redis" only resolves inside the Docker network.
    if not Path("/.dockerenv").is_file() and "://redis:" in raw:
        raw = raw.replace("://redis:", "://127.0.0.1:")
    return raw


_broker_url = _resolve_redis_url("REDIS_BROKER_URL", "redis://127.0.0.1:6379/0")
_result_backend = _resolve_redis_url("REDIS_RESULT_BACKEND", _broker_url)

celery = Celery(
    "child_safety_evals",
    broker=_broker_url,
    backend=_result_backend,
    include=["app.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
)
