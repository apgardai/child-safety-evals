"""Buffered writer that appends benchmark stdout to an evaluation run's progress_log."""

from __future__ import annotations

import time
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud.evaluation_runs import (
    append_evaluation_run_log,
    sync_evaluation_run_scenario_progress,
)
from app.models.evaluation_run import EvaluationRun


class RunLogWriter:
    def __init__(self, db: Session, run_id: UUID) -> None:
        self._db = db
        self._run_id = run_id
        self._buffer = ""
        self._last_flush = time.monotonic()

    def write(self, text: str) -> None:
        if not text:
            return
        self._buffer += text
        if len(self._buffer) >= 4096 or time.monotonic() - self._last_flush >= 2.0:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            return
        run = self._db.get(EvaluationRun, self._run_id)
        if run is None:
            self._buffer = ""
            return
        append_evaluation_run_log(self._db, run, self._buffer)
        sync_evaluation_run_scenario_progress(self._db, run)
        self._buffer = ""
        self._last_flush = time.monotonic()

    def close(self) -> None:
        self.flush()
