"""Celery tasks for long-running benchmark evaluations."""

from __future__ import annotations

import logging
from uuid import UUID

from app.crud.evaluation_runs import (
    append_evaluation_run_log,
    complete_evaluation_run,
    get_evaluation_run_for_account,
    is_evaluation_run_cancelled,
    set_evaluation_run_status,
    sync_evaluation_run_scenario_progress,
)
from app.services.benchmark_runner import BENCHMARK_CANCELLED_MESSAGE
from app.crud.users import get_account_ai_gateway_api_key, get_user_by_id
from app.crud.model_registry import get_custom_runtime_config
from app.services.benchmark_runner import run_benchmark_evaluation
from app.services.celery_app import celery
from app.services.database import SessionLocal
from app.services.run_log_writer import RunLogWriter

logger = logging.getLogger(__name__)


@celery.task(bind=True, name="evaluation.run", soft_time_limit=7200, time_limit=10800)
def run_evaluation(
    self,
    run_id: str,
    user_id: str,
    *,
    target_model: str,
    judge_model: str,
    user_model: str,
    scenarios_input: str,
    prompts: list[str] | None,
) -> dict:
    db = SessionLocal()
    log_writer: RunLogWriter | None = None
    try:
        run_uuid = UUID(run_id)
        user_uuid = UUID(user_id)
        user = get_user_by_id(db, user_uuid)
        if not user:
            raise ValueError(f"User {user_id} not found")

        run = get_evaluation_run_for_account(
            db, run_id=run_uuid, account_id=user.account_id
        )
        if not run:
            raise ValueError(f"Evaluation run {run_id} not found")

        if run.status == "cancelled":
            return {"run_id": run_id, "status": "cancelled"}

        log_writer = RunLogWriter(db, run_uuid)
        append_evaluation_run_log(db, run, "Worker picked up the evaluation task.\n")
        set_evaluation_run_status(
            db,
            run,
            status="running",
            celery_task_id=self.request.id,
        )

        api_key = get_account_ai_gateway_api_key(db, account_id=user.account_id)
        custom_api_key: str | None = None
        custom_api_endpoint: str | None = None
        custom_parsing_key: str | None = None

        if target_model.startswith("custom-"):
            cfg = get_custom_runtime_config(
                db, alias=target_model, account_id=user.account_id
            )
            if not cfg:
                raise ValueError(
                    f"Custom model {target_model} has no saved runtime credentials."
                )
            custom_api_key = cfg["custom_api_key"]
            custom_api_endpoint = cfg["custom_url"]
            custom_parsing_key = cfg.get("parsing_key") or "message"
        elif not api_key:
            raise ValueError(
                "AI Gateway API key is required. Save it on your account before running evaluations."
            )

        account_id = user.account_id

        def should_cancel() -> bool:
            return is_evaluation_run_cancelled(
                db, run_id=run_uuid, account_id=account_id
            )

        output = run_benchmark_evaluation(
            target_model=target_model,
            judge_model=judge_model,
            user_model=user_model,
            scenarios_input=scenarios_input,
            prompts=prompts,
            ai_gateway_api_key=api_key,
            custom_api_key=custom_api_key,
            custom_api_endpoint=custom_api_endpoint,
            custom_parsing_key=custom_parsing_key,
            on_log=log_writer.write,
            should_cancel=should_cancel,
        )
        log_writer.close()

        run = get_evaluation_run_for_account(
            db, run_id=run_uuid, account_id=account_id
        )
        if not run:
            raise ValueError(f"Evaluation run {run_id} not found after benchmark")

        if run:
            sync_evaluation_run_scenario_progress(db, run)

        if run.status == "cancelled" or output.error == BENCHMARK_CANCELLED_MESSAGE:
            return {"run_id": run_id, "status": "cancelled"}

        if not output.success or not output.results:
            msg = output.error or "Benchmark run failed"
            append_evaluation_run_log(db, run, f"\nERROR: {msg}\n")
            if output.log and output.log not in (run.progress_log or ""):
                append_evaluation_run_log(db, run, output.log[-8000:])
            set_evaluation_run_status(
                db,
                run,
                status="failed",
                error_message=msg,
            )
            return {
                "run_id": run_id,
                "status": "failed",
                "error": msg,
            }

        complete_evaluation_run(
            db,
            run=run,
            user=user,
            results=output.results,
            viewer_data=output.viewer_data,
        )
        return {"run_id": run_id, "status": "completed"}

    except Exception as e:
        logger.exception("Evaluation task failed for run %s", run_id)
        if log_writer is not None:
            log_writer.close()
        try:
            run_uuid = UUID(run_id)
            user_uuid = UUID(user_id)
            user = get_user_by_id(db, user_uuid)
            if user:
                run = get_evaluation_run_for_account(
                    db, run_id=run_uuid, account_id=user.account_id
                )
                if run:
                    if run.status == "cancelled":
                        return {"run_id": run_id, "status": "cancelled"}
                    append_evaluation_run_log(db, run, f"\nERROR: {e}\n")
                    set_evaluation_run_status(
                        db, run, status="failed", error_message=str(e)
                    )
        except Exception:
            logger.exception("Could not mark run %s as failed", run_id)
        raise
    finally:
        if log_writer is not None:
            log_writer.close()
        db.close()
