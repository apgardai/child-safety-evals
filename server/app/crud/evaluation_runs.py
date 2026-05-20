from collections import defaultdict
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.assessment import Assessment
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.models.evaluation_run import EvaluationRun
from app.services.benchmark_progress import parse_scenario_progress_from_log
from app.models.evaluation_scenario import EvaluationScenario
from app.models.model_registry import ModelRegistryEntry
from app.models.user import User

_MAX_PROGRESS_LOG_CHARS = 512_000
_ACTIVE_STATUSES = ("pending", "running")
_CANCELLABLE_STATUSES = _ACTIVE_STATUSES


def _num_scores(payload: dict[str, Any]) -> int:
    scores = payload.get("scores")
    if isinstance(scores, list):
        return len(scores)
    return 0


def normalize_safety_outcome(value: str | None) -> str | None:
    """Map viewer / judge output to failing | adequate | exemplary (or None if unknown)."""
    if not value or not isinstance(value, str):
        return None
    s = value.strip().lower()
    if s in ("failing", "adequate", "exemplary"):
        return s
    return None


def aggregate_safety_scores_from_scenarios(rows: list[Any]) -> list[dict[str, Any]]:
    """
    Build results.json-style `scores` rows from per-scenario safety grades stored on scenarios
    (and/or linked assessments). Used when persisting a run without a populated scores array.
    """
    # key -> [failing, adequate, exemplary] counts
    buckets: dict[tuple[str, str, str, str], list[int]] = defaultdict(lambda: [0, 0, 0])

    for s in rows:
        rc = s.risk_category if isinstance(getattr(s, "risk_category", None), str) else ""
        sr = s.sub_risk if isinstance(getattr(s, "sub_risk", None), str) else ""
        ar = s.age_range if isinstance(getattr(s, "age_range", None), str) else ""
        pv = s.prompt_variant if isinstance(getattr(s, "prompt_variant", None), str) else ""
        key = (rc, sr, ar, pv)

        grade_raw = getattr(s, "safety_grade", None)
        if not grade_raw and getattr(s, "assessment", None):
            grade_raw = getattr(s.assessment, "safety_grade", None)
        outcome = normalize_safety_outcome(grade_raw if isinstance(grade_raw, str) else None)
        if outcome == "failing":
            buckets[key][0] += 1
        elif outcome == "adequate":
            buckets[key][1] += 1
        elif outcome == "exemplary":
            buckets[key][2] += 1

    out: list[dict[str, Any]] = []
    for (rc, sr, ar, pv), (f, a, e) in buckets.items():
        total = f + a + e
        if total == 0:
            continue
        out.append(
            {
                "riskCategoryId": rc or "unknown",
                "riskId": sr or "unknown",
                "ageRange": ar or None,
                "prompt": pv or None,
                "sums": {
                    "al": total,
                    "as": [f, a, e],
                },
            }
        )
    return out


def _overall_score_pct(payload: dict[str, Any]) -> float | None:
    scores = payload.get("scores")
    if not isinstance(scores, list) or not scores:
        return None

    failing = 0
    adequate = 0
    exemplary = 0
    for row in scores:
        if not isinstance(row, dict):
            continue
        sums = row.get("sums")
        if not isinstance(sums, dict):
            continue
        as_counts = sums.get("as")
        if not isinstance(as_counts, list) or len(as_counts) < 3:
            continue
        f = as_counts[0]
        a = as_counts[1]
        e = as_counts[2]
        if isinstance(f, int):
            failing += f
        if isinstance(a, int):
            adequate += a
        if isinstance(e, int):
            exemplary += e

    total = failing + adequate + exemplary
    if total <= 0:
        return None
    points = adequate + (2 * exemplary)
    return (points / (total * 2)) * 100.0


def create_pending_evaluation_run(
    db: Session,
    *,
    user: User,
    target_model: str,
    judge_model: str,
    user_model: str,
    prompts: list[str] | None,
    celery_task_id: str | None = None,
) -> EvaluationRun:
    run = EvaluationRun(
        account_id=user.account_id,
        created_by_user_id=user.id,
        target_model_name=target_model,
        judge_model=judge_model,
        user_model=user_model,
        prompts=prompts,
        status="pending",
        celery_task_id=celery_task_id,
        progress_log="Evaluation queued.\n",
        results_json=None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def append_evaluation_run_log(
    db: Session,
    run: EvaluationRun,
    text: str,
    *,
    commit: bool = True,
) -> EvaluationRun:
    if not text:
        return run
    current = run.progress_log or ""
    combined = current + text
    if len(combined) > _MAX_PROGRESS_LOG_CHARS:
        combined = "...[earlier log truncated]\n" + combined[-_MAX_PROGRESS_LOG_CHARS:]
    run.progress_log = combined
    db.add(run)
    if commit:
        db.commit()
        db.refresh(run)
    return run


def get_active_evaluation_run_for_account(
    db: Session,
    *,
    account_id: UUID,
) -> EvaluationRun | None:
    return (
        db.query(EvaluationRun)
        .filter(
            EvaluationRun.account_id == account_id,
            EvaluationRun.status.in_(_ACTIVE_STATUSES),
        )
        .order_by(EvaluationRun.created_at.desc())
        .first()
    )


def evaluation_run_detail_dict(run: EvaluationRun) -> dict[str, Any]:
    payload = run.results_json if isinstance(run.results_json, dict) else None
    prompts = run.prompts
    if prompts is None and isinstance(payload, dict) and isinstance(payload.get("prompts"), list):
        prompts = [str(p) for p in payload["prompts"]]
    elif isinstance(prompts, list):
        prompts = [str(p) for p in prompts]
    return {
        "id": run.id,
        "created_at": run.created_at,
        "status": run.status or "completed",
        "target_model": run.target_model_name,
        "judge_model": run.judge_model,
        "user_model": run.user_model,
        "prompts": prompts,
        "error_message": run.error_message,
        "progress_log": run.progress_log,
        "celery_task_id": run.celery_task_id,
        "scenarios_completed": run.scenarios_completed,
        "scenarios_total": run.scenarios_total,
        "results": payload,
    }


def set_evaluation_run_scenario_total(
    db: Session,
    run: EvaluationRun,
    *,
    scenarios_total: int,
) -> EvaluationRun:
    run.scenarios_total = scenarios_total
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def sync_evaluation_run_scenario_progress(
    db: Session,
    run: EvaluationRun,
) -> EvaluationRun:
    """Update scenarios_completed/total from the latest benchmark progress bar in the log."""
    completed, total = parse_scenario_progress_from_log(run.progress_log)
    changed = False
    if total is not None and run.scenarios_total != total:
        run.scenarios_total = total
        changed = True
    if completed is not None and run.scenarios_completed != completed:
        run.scenarios_completed = completed
        changed = True
    if changed:
        db.add(run)
        db.commit()
        db.refresh(run)
    return run


def is_evaluation_run_cancelled(
    db: Session,
    *,
    run_id: UUID,
    account_id: UUID,
) -> bool:
    run = get_evaluation_run_for_account(db, run_id=run_id, account_id=account_id)
    return run is not None and run.status == "cancelled"


def cancel_evaluation_run(
    db: Session,
    *,
    run: EvaluationRun,
) -> EvaluationRun:
    if run.status not in _CANCELLABLE_STATUSES:
        raise ValueError(
            f"Cannot cancel evaluation run with status {run.status!r}"
        )
    append_evaluation_run_log(db, run, "\nEvaluation cancelled by user.\n")
    return set_evaluation_run_status(db, run, status="cancelled")


def set_evaluation_run_status(
    db: Session,
    run: EvaluationRun,
    *,
    status: str,
    celery_task_id: str | None = None,
    error_message: str | None = None,
) -> EvaluationRun:
    run.status = status
    if celery_task_id is not None:
        run.celery_task_id = celery_task_id
    if error_message is not None:
        run.error_message = error_message
    if status == "running" and not (run.progress_log or "").strip():
        run.progress_log = (run.progress_log or "") + "Worker started.\n"
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _persist_run_details(
    db: Session,
    *,
    run: EvaluationRun,
    user: User,
    results: dict[str, Any],
    viewer_data: dict[str, Any] | None = None,
) -> EvaluationRun:
    prompts = results.get("prompts")
    if prompts is not None and not isinstance(prompts, list):
        prompts = None

    target_name = results.get("target") if isinstance(results.get("target"), str) else None
    judge_name = results.get("judge") if isinstance(results.get("judge"), str) else None
    user_name = results.get("user") if isinstance(results.get("user"), str) else None
    target_model_id: UUID | None = None
    if target_name:
        target_entry = (
            db.query(ModelRegistryEntry)
            .filter(
                (ModelRegistryEntry.alias == target_name)
                | (ModelRegistryEntry.model_id == target_name)
            )
            .first()
        )
        if target_entry:
            target_model_id = target_entry.id

    run.target_model_id = target_model_id
    run.target_model_name = target_name or run.target_model_name
    run.judge_model = judge_name or run.judge_model
    run.user_model = user_name or run.user_model
    if prompts is not None:
        run.prompts = prompts
    run.results_json = results
    run.status = "completed"
    run.error_message = None
    append_evaluation_run_log(
        db,
        run,
        "\nEvaluation completed successfully.\n",
        commit=False,
    )
    db.add(run)
    db.flush()

    user_persona_model_id: UUID | None = None
    if user_name:
        user_model_entry = (
            db.query(ModelRegistryEntry)
            .filter(
                (ModelRegistryEntry.alias == user_name)
                | (ModelRegistryEntry.model_id == user_name)
            )
            .first()
        )
        if user_model_entry:
            user_persona_model_id = user_model_entry.id

    has_viewer_scenarios = isinstance(viewer_data, dict) and isinstance(
        viewer_data.get("scenarios"), list
    )
    if has_viewer_scenarios:
        for idx, row in enumerate(viewer_data["scenarios"]):
            if not isinstance(row, dict):
                continue
            risk_category = row.get("riskCategoryId") if isinstance(row.get("riskCategoryId"), str) else None
            sub_risk = row.get("riskId") if isinstance(row.get("riskId"), str) else None
            age_range = row.get("ageRange") if isinstance(row.get("ageRange"), str) else None
            prompt_variant = row.get("prompt") if isinstance(row.get("prompt"), str) else None
            scenario_title = row.get("scenarioTitle") if isinstance(row.get("scenarioTitle"), str) else None
            narrative = row.get("narrative") if isinstance(row.get("narrative"), str) else None
            safety_grade_raw = row.get("safetyGrade") if isinstance(row.get("safetyGrade"), str) else None
            outcome = normalize_safety_outcome(safety_grade_raw)
            assessment_reasons = (
                row.get("assessmentReasons")
                if isinstance(row.get("assessmentReasons"), str)
                else None
            )
            external_id = row.get("id") if isinstance(row.get("id"), str) else None

            conv = Conversation(
                evaluation_run_id=run.id,
                title=scenario_title or f"Scenario {idx + 1}",
            )
            db.add(conv)
            db.flush()
            messages = row.get("messages")
            if isinstance(messages, list):
                turn = 0
                for m in messages:
                    if not isinstance(m, dict):
                        continue
                    role = m.get("role")
                    content = m.get("content")
                    if role not in {"user", "assistant"}:
                        continue
                    if not isinstance(content, str):
                        continue
                    db.add(
                        ConversationMessage(
                            conversation_id=conv.id,
                            turn_index=turn,
                            role=role,
                            content=content,
                        )
                    )
                    turn += 1

            assessment = Assessment(
                evaluation_run_id=run.id,
                conversation_id=conv.id,
                status="completed",
                age_range=age_range,
                prompt_variant=prompt_variant,
                safety_grade=outcome,
                assessment_reasons=assessment_reasons,
            )
            db.add(assessment)
            db.flush()

            db.add(
                EvaluationScenario(
                    evaluation_run_id=run.id,
                    assessment_id=assessment.id,
                    conversation_id=conv.id,
                    user_persona_model_id=user_persona_model_id,
                    scenario_external_id=external_id,
                    scenario_title=scenario_title,
                    prompt_variant=prompt_variant,
                    age_range=age_range,
                    safety_grade=outcome,
                    assessment_reasons=assessment_reasons,
                    narrative=(
                        narrative
                        or scenario_title
                        or f"Scenario {idx + 1}: {risk_category or 'unknown'} / {sub_risk or 'unknown'}"
                    ),
                    sub_risk=sub_risk,
                    risk_category=risk_category,
                )
            )

        # Ensure results_json carries aggregate scores for overview APIs when CLI omitted them.
        existing_scores = results.get("scores")
        if not isinstance(existing_scores, list) or len(existing_scores) == 0:
            fresh_scenarios = (
                db.query(EvaluationScenario)
                .filter(EvaluationScenario.evaluation_run_id == run.id)
                .all()
            )
            aggregated = aggregate_safety_scores_from_scenarios(fresh_scenarios)
            if aggregated:
                results = {**results, "scores": aggregated}
                run.results_json = results
                db.add(run)
    else:
        scores = results.get("scores")
        if isinstance(scores, list):
            for row in scores:
                if not isinstance(row, dict):
                    continue
                age_range = row.get("ageRange") if isinstance(row.get("ageRange"), str) else None
                prompt_variant = row.get("prompt") if isinstance(row.get("prompt"), str) else None
                risk_category = (
                    row.get("riskCategoryId")
                    if isinstance(row.get("riskCategoryId"), str)
                    else None
                )
                sub_risk = row.get("riskId") if isinstance(row.get("riskId"), str) else None

                assessment = Assessment(
                    evaluation_run_id=run.id,
                    status="completed",
                    age_range=age_range,
                    prompt_variant=prompt_variant,
                )
                db.add(assessment)
                db.flush()
                narrative = (
                    f"{risk_category or 'Unknown category'} / {sub_risk or 'Unknown risk'} "
                    f"for age {age_range or 'unspecified'} and prompt {prompt_variant or 'unspecified'}"
                )
                db.add(
                    EvaluationScenario(
                        evaluation_run_id=run.id,
                        assessment_id=assessment.id,
                        user_persona_model_id=user_persona_model_id,
                        narrative=narrative,
                        sub_risk=sub_risk,
                        risk_category=risk_category,
                        age_range=age_range,
                        prompt_variant=prompt_variant,
                    )
                )

    db.commit()
    db.refresh(run)
    return run


def create_evaluation_run(
    db: Session,
    *,
    user: User,
    results: dict[str, Any],
    viewer_data: dict[str, Any] | None = None,
) -> EvaluationRun:
    run = EvaluationRun(
        account_id=user.account_id,
        created_by_user_id=user.id,
        status="completed",
        results_json=results,
    )
    db.add(run)
    db.flush()
    return _persist_run_details(db, run=run, user=user, results=results, viewer_data=viewer_data)


def complete_evaluation_run(
    db: Session,
    *,
    run: EvaluationRun,
    user: User,
    results: dict[str, Any],
    viewer_data: dict[str, Any] | None = None,
) -> EvaluationRun:
    return _persist_run_details(db, run=run, user=user, results=results, viewer_data=viewer_data)


def list_evaluation_runs_for_account(
    db: Session,
    *,
    account_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[EvaluationRun]:
    q = (
        db.query(EvaluationRun)
        .filter(EvaluationRun.account_id == account_id)
        .order_by(EvaluationRun.created_at.desc())
    )
    return q.offset(offset).limit(limit).all()


def get_evaluation_run_for_account(
    db: Session,
    *,
    run_id: UUID,
    account_id: UUID,
) -> EvaluationRun | None:
    return (
        db.query(EvaluationRun)
        .filter(EvaluationRun.id == run_id, EvaluationRun.account_id == account_id)
        .first()
    )


def delete_evaluation_run_for_account(
    db: Session,
    *,
    run_id: UUID,
    account_id: UUID,
) -> bool:
    run = get_evaluation_run_for_account(db, run_id=run_id, account_id=account_id)
    if not run:
        return False
    db.delete(run)
    db.commit()
    return True


def summarize_run(run: EvaluationRun) -> dict[str, Any]:
    payload = run.results_json if isinstance(run.results_json, dict) else {}
    prompts = run.prompts
    if prompts is None and isinstance(payload.get("prompts"), list):
        prompts = [str(p) for p in payload["prompts"]]
    elif isinstance(prompts, list):
        prompts = [str(p) for p in prompts]

    return {
        "id": run.id,
        "created_at": run.created_at,
        "status": run.status or "completed",
        "target_model": run.target_model_name,
        "judge_model": run.judge_model,
        "user_model": run.user_model,
        "prompts": prompts,
        "num_scores": _num_scores(payload),
        "overall_score_pct": _overall_score_pct(payload),
        "error_message": run.error_message,
        "progress_log": run.progress_log,
        "scenarios_completed": run.scenarios_completed,
        "scenarios_total": run.scenarios_total,
    }
