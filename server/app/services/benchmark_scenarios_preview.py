"""Load expanded scenarios from benchmark data for pre-run preview."""

from __future__ import annotations

import json
import random
from typing import Any

from app.schemas.benchmark_preview import BenchmarkScenarioPreviewRow, BenchmarkScenariosPreviewOut
from app.services.benchmark_progress import count_scenario_test_tasks, resolve_scenarios_path

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


def load_benchmark_scenarios_preview(
    scenarios_input: str = "data/scenarios.jsonl",
    prompts: list[str] | None = None,
) -> BenchmarkScenariosPreviewOut:
    prompt_list = prompts if prompts else ["default"]
    scenarios_path = resolve_scenarios_path(scenarios_input)
    if not scenarios_path.is_file():
        raise FileNotFoundError(f"Scenarios file not found: {scenarios_path}")

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

    test_count = count_scenario_test_tasks(scenarios_input, prompt_list)
    return BenchmarkScenariosPreviewOut(
        input_path=scenarios_input,
        scenario_count=len(rows),
        test_count=test_count,
        prompt_variants=prompt_list,
        scenarios=_sample_preview_rows(rows),
    )
