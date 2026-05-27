"""Buffered writer that appends benchmark stdout to an evaluation run's progress_log."""

from __future__ import annotations

import time
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud.evaluation_runs import (
    append_evaluation_run_log,
    sync_evaluation_run_scenario_progress,
)
from app.crud.users import get_user_by_id
from app.models.evaluation_run import EvaluationRun
from app.services.benchmark_paths import evaluation_workspace_dir
from app.services.incremental_scenario_sync import sync_evaluation_workspace


class RunLogWriter:
    def __init__(
        self,
        db: Session,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
        workspace_dir: Path | None = None,
    ) -> None:
        self._db = db
        self._run_id = run_id
        self._user_id = user_id
        self._workspace_dir = workspace_dir or evaluation_workspace_dir(run_id)
        self._buffer = ""
        self._last_flush = time.monotonic()
        self._seen_temp_files: set[str] = set()

    def write(self, text: str) -> None:
        if not text:
            return
        self._buffer += text
        if len(self._buffer) >= 4096 or time.monotonic() - self._last_flush >= 2.0:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            self._sync_workspace()
            return
        run = self._db.get(EvaluationRun, self._run_id)
        if run is None:
            self._buffer = ""
            return
        append_evaluation_run_log(self._db, run, self._buffer)
        sync_evaluation_run_scenario_progress(self._db, run)
        self._buffer = ""
        self._last_flush = time.monotonic()
        self._sync_workspace()

    def _sync_workspace(self) -> None:
        if self._user_id is None:
            return
        run = self._db.get(EvaluationRun, self._run_id)
        user = get_user_by_id(self._db, self._user_id)
        if run is None or user is None:
            return
        sync_evaluation_workspace(
            self._db,
            run=run,
            user=user,
            workspace_dir=self._workspace_dir,
            seen_temp_files=self._seen_temp_files,
        )

    def close(self) -> None:
        self.flush()
