from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.assessment import Assessment
from app.models.conversation import Conversation
from app.models.conversation_message import ConversationMessage
from app.models.evaluation_run import EvaluationRun
from app.models.evaluation_scenario import EvaluationScenario
from app.models.model_registry import ModelRegistryEntry
from app.models.user import User


def _num_scores(payload: dict[str, Any]) -> int:
    scores = payload.get("scores")
    if isinstance(scores, list):
        return len(scores)
    return 0


def create_evaluation_run(
    db: Session,
    *,
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

    run = EvaluationRun(
        account_id=user.account_id,
        created_by_user_id=user.id,
        target_model_id=target_model_id,
        target_model_name=target_name,
        judge_model=judge_name,
        user_model=user_name,
        prompts=prompts,
        results_json=results,
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

    assessments_by_tuple: dict[tuple[str, str, str], Assessment] = {}
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
            safety_grade = row.get("safetyGrade") if isinstance(row.get("safetyGrade"), str) else None
            assessment_reasons = (
                row.get("assessmentReasons")
                if isinstance(row.get("assessmentReasons"), str)
                else None
            )
            external_id = row.get("id") if isinstance(row.get("id"), str) else None
            key = (
                risk_category or "",
                sub_risk or "",
                (age_range or "") + "|" + (prompt_variant or ""),
            )
            assessment = assessments_by_tuple.get(key)
            if assessment:
                if safety_grade and not assessment.safety_grade:
                    assessment.safety_grade = safety_grade
                if assessment_reasons and not assessment.assessment_reasons:
                    assessment.assessment_reasons = assessment_reasons

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

            db.add(
                EvaluationScenario(
                    evaluation_run_id=run.id,
                    assessment_id=assessment.id if assessment else None,
                    conversation_id=conv.id,
                    user_persona_model_id=user_persona_model_id,
                    scenario_external_id=external_id,
                    scenario_title=scenario_title,
                    prompt_variant=prompt_variant,
                    age_range=age_range,
                    safety_grade=safety_grade,
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
                sums = row.get("sums")
                summary = None
                if isinstance(sums, dict):
                    summary = (
                        f"Risk category={risk_category or 'unknown'}, "
                        f"sub risk={sub_risk or 'unknown'}, "
                        f"totals={sums}"
                    )

                assessment = Assessment(
                    evaluation_run_id=run.id,
                    status="completed",
                    age_range=age_range,
                    prompt_variant=prompt_variant,
                    summary=summary,
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
        "target_model": run.target_model_name,
        "judge_model": run.judge_model,
        "user_model": run.user_model,
        "prompts": prompts,
        "num_scores": _num_scores(payload),
    }
