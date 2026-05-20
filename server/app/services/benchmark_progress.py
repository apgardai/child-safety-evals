"""Scenario test counts and progress parsed from benchmark CLI stdout."""

from __future__ import annotations

import json
import re
from pathlib import Path

from app.services.benchmark_paths import benchmark_root

# CLI progress bar: `(12/450) | ✓ 10 ✗ 2`
_SCENARIO_PROGRESS_RE = re.compile(r"\((\d+)/(\d+)\)\s*\|")


def resolve_scenarios_path(scenarios_input: str) -> Path:
    path = Path(scenarios_input)
    if path.is_absolute():
        return path
    return benchmark_root() / path


def count_scenario_test_tasks(
    scenarios_input: str,
    prompts: list[str] | None,
) -> int:
    """Mirror benchmark CLI countTestTasks: one test per scenario × prompt variant."""
    scenarios_path = resolve_scenarios_path(scenarios_input)
    if not scenarios_path.is_file():
        raise FileNotFoundError(f"Scenarios file not found: {scenarios_path}")

    prompt_list = prompts if prompts else ["default"]
    count = 0
    with scenarios_path.open(encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            json.loads(stripped)
            count += len(prompt_list)
    return count


def parse_scenario_progress_from_log(text: str | None) -> tuple[int | None, int | None]:
    """Return the latest (completed, total) from benchmark progress bar output."""
    if not text:
        return None, None
    completed: int | None = None
    total: int | None = None
    for match in _SCENARIO_PROGRESS_RE.finditer(text):
        completed = int(match.group(1))
        total = int(match.group(2))
    return completed, total
