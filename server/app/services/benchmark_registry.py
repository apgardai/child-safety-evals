"""Resolve benchmark variants (wellbeing, CSEA) from ``data/benchmarks.json``."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services.benchmark_paths import benchmark_root

DEFAULT_BENCHMARK_ID = "wellbeing"
LOCAL_MODEL_RUN_ID_PREFIX = "local-model-"
LOCAL_CSEA_RUN_ID_PREFIX = "local-csea-"


@lru_cache(maxsize=1)
def load_benchmarks_registry() -> dict[str, dict[str, Any]]:
    path = benchmark_root() / "data" / "benchmarks.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    benchmarks = raw.get("benchmarks")
    if not isinstance(benchmarks, dict):
        raise ValueError(f"Invalid benchmarks.json at {path}")
    return benchmarks


def default_benchmark_id() -> str:
    for bid, entry in load_benchmarks_registry().items():
        if isinstance(entry, dict) and entry.get("default"):
            return str(bid)
    return DEFAULT_BENCHMARK_ID


def normalize_benchmark_id(benchmark_id: str | None) -> str:
    bid = (benchmark_id or "").strip() or default_benchmark_id()
    if bid not in load_benchmarks_registry():
        known = ", ".join(sorted(load_benchmarks_registry()))
        raise ValueError(f"Unknown benchmark '{bid}'. Known benchmarks: {known}")
    return bid


def benchmark_definition(benchmark_id: str | None) -> dict[str, Any]:
    bid = normalize_benchmark_id(benchmark_id)
    entry = load_benchmarks_registry()[bid]
    root = benchmark_root()
    scenarios_file = str(entry.get("scenariosFile") or "")
    return {
        "id": bid,
        "label": str(entry.get("label") or bid),
        "description": str(entry.get("description") or ""),
        "resultsDir": str(entry.get("resultsDir") or ""),
        "scenariosFile": scenarios_file,
        "risksFile": str(entry.get("risksFile") or ""),
        "resultsRoot": root / "data" / str(entry.get("resultsDir") or ""),
        "risksPath": root / str(entry.get("risksFile") or ""),
        "scenariosPath": root / scenarios_file if scenarios_file else root,
    }


def scenarios_file_for_benchmark(benchmark_id: str | None) -> str:
    """Relative scenarios path (from benchmark root) for a benchmark id."""
    scenarios_file = str(benchmark_definition(benchmark_id).get("scenariosFile") or "").strip()
    if not scenarios_file:
        raise ValueError(
            f"Benchmark '{normalize_benchmark_id(benchmark_id)}' has no scenariosFile configured"
        )
    return scenarios_file


def list_benchmarks() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for bid, entry in load_benchmarks_registry().items():
        if not isinstance(entry, dict):
            continue
        out.append(
            {
                "id": bid,
                "label": str(entry.get("label") or bid),
                "description": str(entry.get("description") or ""),
                "default": bool(entry.get("default")),
            }
        )
    out.sort(key=lambda b: (not b.get("default"), b.get("label") or ""))
    return out


def model_results_root(benchmark_id: str | None = None) -> Path:
    return benchmark_definition(benchmark_id)["resultsRoot"]


def load_risk_taxonomy(benchmark_id: str | None = None) -> list[dict[str, Any]]:
    path = benchmark_definition(benchmark_id)["risksPath"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def model_results_run_id(model_dir: str, benchmark_id: str | None = None) -> str:
    bid = normalize_benchmark_id(benchmark_id)
    if bid == "csea":
        return f"{LOCAL_CSEA_RUN_ID_PREFIX}{model_dir}"
    return f"{LOCAL_MODEL_RUN_ID_PREFIX}{model_dir}"


def parse_local_model_run_id(run_id: str) -> tuple[str, str] | None:
    rid = (run_id or "").strip()
    if rid.startswith(LOCAL_CSEA_RUN_ID_PREFIX):
        suffix = rid[len(LOCAL_CSEA_RUN_ID_PREFIX) :].strip()
        if suffix:
            return suffix, "csea"
        return None
    if rid.startswith(LOCAL_MODEL_RUN_ID_PREFIX):
        suffix = rid[len(LOCAL_MODEL_RUN_ID_PREFIX) :].strip()
        if suffix:
            return suffix, "wellbeing"
        return None
    return None
