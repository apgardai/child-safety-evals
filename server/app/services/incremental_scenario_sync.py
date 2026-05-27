"""Sync completed benchmark test temp files into DB tables for live / cancelled runs."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud.evaluation_runs import (
    aggregate_safety_scores_from_scenarios,
    upsert_scenario_from_test_result,
)
from app.models.evaluation_run import EvaluationRun
from app.models.evaluation_scenario import EvaluationScenario
from app.models.user import User
from app.services.benchmark_paths import evaluation_workspace_dir

logger = logging.getLogger(__name__)


def sync_evaluation_workspace(
    db: Session,
    *,
    run: EvaluationRun,
    user: User,
    workspace_dir: Path | None = None,
    seen_temp_files: set[str] | None = None,
) -> int:
    """
    Read new ``.benchmark-run-tmp/*.json`` test results and upsert scenario rows.
    Returns the number of newly ingested temp files this pass.
    """
    if workspace_dir is None:
        workspace_dir = evaluation_workspace_dir(run.id)
    temp_dir = workspace_dir / ".benchmark-run-tmp"
    if not temp_dir.is_dir():
        return 0

    seen = seen_temp_files if seen_temp_files is not None else set()
    ingested = 0
    for path in sorted(temp_dir.glob("*.json")):
        name = path.name
        if name in seen:
            continue
        try:
            raw = path.read_text(encoding="utf-8")
            test_result = json.loads(raw)
        except (OSError, json.JSONDecodeError) as e:
            logger.debug("Skip temp result %s: %s", path, e)
            continue
        if not isinstance(test_result, dict):
            continue
        try:
            if upsert_scenario_from_test_result(
                db, run=run, user=user, test_result=test_result
            ):
                seen.add(name)
                ingested += 1
        except Exception:
            logger.exception("Failed to persist test result from %s", path)
            db.rollback()
    if ingested > 0:
        run = db.get(EvaluationRun, run.id)
        if run is not None:
            refresh_run_partial_results_json(db, run)
    return ingested


def refresh_run_partial_results_json(db: Session, run: EvaluationRun) -> None:
    """Update ``results_json`` aggregate scores from scenarios persisted so far."""
    scenario_rows = (
        db.query(EvaluationScenario)
        .filter(EvaluationScenario.evaluation_run_id == run.id)
        .all()
    )
    if not scenario_rows:
        return
    scores = aggregate_safety_scores_from_scenarios(scenario_rows)
    payload: dict[str, Any] = (
        dict(run.results_json) if isinstance(run.results_json, dict) else {}
    )
    if run.target_model_name:
        payload["target"] = run.target_model_name
    if run.judge_model:
        payload["judge"] = run.judge_model
    if run.user_model:
        payload["user"] = run.user_model
    if run.prompts is not None:
        payload["prompts"] = run.prompts
    if scores:
        payload["scores"] = scores
    run.results_json = payload
    db.add(run)
    db.commit()
    db.refresh(run)
