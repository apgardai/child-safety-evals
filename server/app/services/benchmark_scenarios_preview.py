"""Load expanded scenarios from benchmark data for pre-run preview."""

from __future__ import annotations

import json
import random
from typing import Any

from app.schemas.benchmark_preview import BenchmarkScenarioPreviewRow, BenchmarkScenariosPreviewOut
from app.services.benchmark_progress import count_scenario_test_tasks, resolve_scenarios_path
from app.services.benchmark_registry import (
    benchmark_definition,
    default_benchmark_id,
    normalize_benchmark_id,
    scenarios_file_for_benchmark,
)

_PREVIEW_MESSAGE_LEN = 160
_PREVIEW_ROW_LIMIT = 50


def _preview_text(value: Any, *, max_len: int = _PREVIEW_MESSAGE_LEN) -> str:
    text = str(value or "").strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _motivation_label(seed: dict[str, Any]) -> str:
    motivation = seed.get("motivation")
    if isinstance(motivation, dict):
        name = motivation.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    if isinstance(motivation, str) and motivation.strip():
        return motivation.strip()
    return ""


def _sample_preview_rows(
    rows: list[BenchmarkScenarioPreviewRow],
    limit: int = _PREVIEW_ROW_LIMIT,
) -> list[BenchmarkScenarioPreviewRow]:
    if len(rows) <= limit:
        return rows
    sample = random.sample(rows, limit)
    return sorted(sample, key=lambda row: row.index)


def resolve_scenarios_input(
    *,
    benchmark: str | None = None,
    scenarios_input: str | None = None,
) -> tuple[str, str | None]:
    """
    Resolve scenarios path for preview/run.

    Prefer ``benchmark`` id (maps via registry). Fall back to explicit path or default benchmark.
    Returns ``(scenarios_input, benchmark_id_or_none)``.
    """
    explicit = (scenarios_input or "").strip()
    bid_raw = (benchmark or "").strip()
    if bid_raw:
        bid = normalize_benchmark_id(bid_raw)
        return scenarios_file_for_benchmark(bid), bid
    if explicit:
        return explicit, None
    bid = default_benchmark_id()
    return scenarios_file_for_benchmark(bid), bid


def load_benchmark_scenarios_preview(
    *,
    benchmark: str | None = None,
    scenarios_input: str | None = None,
    prompts: list[str] | None = None,
) -> BenchmarkScenariosPreviewOut:
    prompt_list = prompts if prompts else ["default"]
    resolved_input, bid = resolve_scenarios_input(
        benchmark=benchmark,
        scenarios_input=scenarios_input,
    )
    scenarios_path = resolve_scenarios_path(resolved_input)
    if not scenarios_path.is_file():
        raise FileNotFoundError(f"Scenarios file not found for selected benchmark")

    rows: list[BenchmarkScenarioPreviewRow] = []
    with scenarios_path.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            record = json.loads(stripped)
            seed = record.get("seed") if isinstance(record.get("seed"), dict) else {}
            scenario_id = str(seed.get("id") or f"scenario-{index}")
            short_title = str(record.get("shortTitle") or seed.get("shortTitle") or scenario_id)
            rows.append(
                BenchmarkScenarioPreviewRow(
                    index=index,
                    scenario_id=scenario_id,
                    short_title=short_title,
                    risk_category_id=str(seed.get("riskCategoryId") or ""),
                    risk_id=str(seed.get("riskId") or ""),
                    age_range=str(seed.get("ageRange") or ""),
                    motivation=_motivation_label(seed),
                    risk_signal_type=str(seed.get("riskSignalType") or ""),
                    child_age=int(seed.get("childAge") or 0),
                    child_gender=str(seed.get("childGender") or ""),
                    social_context=str(seed.get("socialContext") or ""),
                    first_user_message_preview=_preview_text(record.get("firstUserMessage")),
                )
            )

    test_count = count_scenario_test_tasks(resolved_input, prompt_list)
    label: str | None = None
    description: str | None = None
    if bid:
        definition = benchmark_definition(bid)
        label = str(definition.get("label") or bid)
        description = str(definition.get("description") or "") or None

    return BenchmarkScenariosPreviewOut(
        benchmark=bid,
        label=label,
        description=description,
        scenario_count=len(rows),
        test_count=test_count,
        prompt_variants=prompt_list,
        scenarios=_sample_preview_rows(rows),
    )
