"""Revoke in-flight Celery evaluation tasks."""

from __future__ import annotations

import logging

from app.services.celery_app import celery

logger = logging.getLogger(__name__)


def revoke_evaluation_celery_task(task_id: str | None) -> None:
    if not task_id:
        return
    try:
        celery.control.revoke(task_id, terminate=True, signal="SIGTERM")
    except Exception:
        logger.exception("Failed to revoke Celery task %s", task_id)
