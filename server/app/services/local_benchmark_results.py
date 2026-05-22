"""Read completed benchmark CLI outputs from ``benchmark/data/model-results/{model_dir}/``."""

from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.crud.evaluation_runs import _overall_score_pct
from app.services.benchmark_paths import benchmark_root

_MODEL_DIR_RE = re.compile(r"^[a-z0-9._-]+$")
LOCAL_MODEL_RUN_ID_PREFIX = "local-model-"


def model_results_root() -> Path:
    return benchmark_root() / "data" / "model-results"


def _validate_model_dir(model_dir: str) -> str:
    name = (model_dir or "").strip()
    if not name or not _MODEL_DIR_RE.fullmatch(name):
        raise ValueError("Invalid model results directory name.")
    return name


def model_results_run_id(model_dir: str) -> str:
    return f"{LOCAL_MODEL_RUN_ID_PREFIX}{_validate_model_dir(model_dir)}"


def is_local_run_id(run_id: str) -> bool:
    return (run_id or "").strip().startswith(LOCAL_MODEL_RUN_ID_PREFIX)


def parse_local_model_run_id(run_id: str) -> str | None:
    rid = (run_id or "").strip()
    if not rid.startswith(LOCAL_MODEL_RUN_ID_PREFIX):
        return None
    try:
        return _validate_model_dir(rid[len(LOCAL_MODEL_RUN_ID_PREFIX) :])
    except ValueError:
        return None


def _results_bundle_dir(base: Path) -> Path:
    """Directory that contains ``results.json`` (model dir or nested ``results/``)."""
    for candidate in (base, base / "results"):
        if (candidate / "results.json").is_file():
            return candidate
    raise FileNotFoundError(f"No results.json under {base}")


def _run_summary_from_bundle(
    bundle_dir: Path,
    *,
    run_id: str,
    model_dir: str | None = None,
) -> dict[str, Any] | None:
    results_json = bundle_dir / "results.json"
    doc = _read_results_document(results_json)
    if not doc:
        return None
    scores = doc.get("scores") if isinstance(doc.get("scores"), list) else []
    try:
        mtime = datetime.fromtimestamp(
            results_json.stat().st_mtime, tz=timezone.utc
        ).isoformat()
    except OSError:
        mtime = datetime.now(timezone.utc).isoformat()
    target = (
        str(doc.get("target")) if isinstance(doc.get("target"), str) else None
    )
    return {
        "id": run_id,
        "created_at": mtime,
        "target_model": target,
        "judge_model": (
            str(doc.get("judge")) if isinstance(doc.get("judge"), str) else None
        ),
        "user_model": (
            str(doc.get("user")) if isinstance(doc.get("user"), str) else None
        ),
        "overall_score_pct": _overall_score_pct(doc),
        "risk_scores": _risk_scores(scores),
        "risk_items": _risk_items(scores),
        "source": "local-file",
        "model_dir": model_dir,
        "file_path": str(results_json),
    }


def _risk_scores(scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, int]] = {}
    for row in scores:
        if not isinstance(row, dict):
            continue
        category_id = str(row.get("riskCategoryId") or "unknown")
        sums = row.get("sums")
        if not isinstance(sums, dict):
            continue
        as_counts = sums.get("as")
        if not isinstance(as_counts, list) or len(as_counts) < 3:
            continue
        bucket = grouped.setdefault(
            category_id, {"failing": 0, "adequate": 0, "exemplary": 0}
        )
        for key, idx in (("failing", 0), ("adequate", 1), ("exemplary", 2)):
            val = as_counts[idx]
            if isinstance(val, int):
                bucket[key] += val

    out: list[dict[str, Any]] = []
    for category_id, counts in grouped.items():
        total = counts["failing"] + counts["adequate"] + counts["exemplary"]
        score = (
            0.0
            if total == 0
            else ((counts["adequate"] + counts["exemplary"] * 2) / (total * 2)) * 100.0
        )
        out.append(
            {
                "risk_category_id": category_id,
                "overall_score_pct": score,
            }
        )
    out.sort(key=lambda x: x["overall_score_pct"], reverse=True)
    return out


def _risk_items(scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in scores:
        if not isinstance(row, dict):
            continue
        sums = row.get("sums")
        if not isinstance(sums, dict):
            continue
        as_counts = sums.get("as")
        if not isinstance(as_counts, list) or len(as_counts) < 3:
            continue
        failing = as_counts[0] if isinstance(as_counts[0], int) else 0
        adequate = as_counts[1] if isinstance(as_counts[1], int) else 0
        exemplary = as_counts[2] if isinstance(as_counts[2], int) else 0
        total = failing + adequate + exemplary
        score = (
            0.0
            if total == 0
            else ((adequate + exemplary * 2) / (total * 2)) * 100.0
        )
        items.append(
            {
                "risk_category_id": str(row.get("riskCategoryId") or "unknown"),
                "risk_id": str(row.get("riskId") or "unknown"),
                "overall_score_pct": score,
            }
        )
    items.sort(key=lambda x: x["overall_score_pct"], reverse=True)
    return items


def _read_results_document(results_json_path: Path) -> dict[str, Any] | None:
    try:
        raw = results_json_path.read_text(encoding="utf-8")
        parsed = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _load_risk_taxonomy() -> list[dict[str, Any]]:
    path = benchmark_root() / "packages" / "benchmark" / "data" / "risks.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def _risk_label_maps(
    risks: list[dict[str, Any]],
) -> tuple[dict[str, str], dict[str, str]]:
    category_by_id: dict[str, str] = {}
    risk_by_key: dict[str, str] = {}
    for category in risks:
        if not isinstance(category, dict):
            continue
        cid = category.get("id")
        if not isinstance(cid, str) or not cid:
            continue
        category_by_id[cid] = str(category.get("name") or cid)
        for risk in category.get("risks") or []:
            if not isinstance(risk, dict):
                continue
            rid = risk.get("id")
            if not isinstance(rid, str) or not rid:
                continue
            risk_by_key[f"{cid}:{rid}"] = str(risk.get("name") or rid)
    return category_by_id, risk_by_key


def _normalize_scenario_record(
    record: dict[str, Any],
    file_name: str,
    category_by_id: dict[str, str],
    risk_by_key: dict[str, str],
) -> dict[str, Any]:
    scenario = record.get("scenario") if isinstance(record.get("scenario"), dict) else {}
    seed = scenario.get("seed") if isinstance(scenario.get("seed"), dict) else {}
    assessment = (
        record.get("assessment") if isinstance(record.get("assessment"), dict) else {}
    )

    risk_category_id = str(seed.get("riskCategoryId") or "")
    risk_id = str(seed.get("riskId") or "")
    risk_key = f"{risk_category_id}:{risk_id}"

    messages_raw = record.get("messages") if isinstance(record.get("messages"), list) else []
    messages = []
    for msg in messages_raw:
        if not isinstance(msg, dict):
            continue
        messages.append(
            {
                "role": str(msg.get("role") or ""),
                "content": str(msg.get("content") or ""),
            }
        )

    motivation = seed.get("motivation") if isinstance(seed.get("motivation"), dict) else {}
    return {
        "file": file_name,
        "id": str(seed.get("id") or file_name),
        "prompt": str(record.get("prompt") or "default"),
        "riskCategoryId": risk_category_id,
        "riskCategoryName": category_by_id.get(risk_category_id) or risk_category_id or "Unknown",
        "riskId": risk_id,
        "riskName": risk_by_key.get(risk_key) or risk_id or "Unknown",
        "ageRange": str(seed.get("ageRange") or ""),
        "scenarioTitle": str(
            scenario.get("shortTitle") or seed.get("shortTitle") or "Untitled scenario"
        ),
        "narrative": str(scenario.get("narrative") or ""),
        "evaluationCriteria": str(scenario.get("evaluationCriteria") or ""),
        "firstUserMessage": str(scenario.get("firstUserMessage") or ""),
        "motivationName": str(motivation.get("name") or ""),
        "safetyGrade": str(assessment.get("grade") or ""),
        "assessmentReasons": str(assessment.get("reasons") or ""),
        "messages": messages,
    }


def _scenarios_from_test_results_dir(
    test_results_dir: Path,
    category_by_id: dict[str, str],
    risk_by_key: dict[str, str],
) -> list[dict[str, Any]]:
    scenarios: list[dict[str, Any]] = []
    if not test_results_dir.is_dir():
        return scenarios
    for path in sorted(test_results_dir.glob("*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(record, dict):
            continue
        scenarios.append(
            _normalize_scenario_record(record, path.name, category_by_id, risk_by_key)
        )
    return scenarios


def _scenarios_from_zip(
    zip_path: Path,
    category_by_id: dict[str, str],
    risk_by_key: dict[str, str],
) -> list[dict[str, Any]]:
    scenarios: list[dict[str, Any]] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if not name.startswith("testResults/") or not name.endswith(".json"):
                continue
            if name.count("/") != 1:
                continue
            try:
                raw = zf.read(name).decode("utf-8")
                record = json.loads(raw)
            except (KeyError, json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(record, dict):
                continue
            file_name = name.split("/")[-1]
            scenarios.append(
                _normalize_scenario_record(record, file_name, category_by_id, risk_by_key)
            )
    return scenarios


def list_model_result_runs() -> list[dict[str, Any]]:
    """Summaries for leaderboard (mirrors Next ``/api/model-results``)."""
    runs: list[dict[str, Any]] = []
    root = model_results_root()
    if root.is_dir():
        for entry in sorted(root.iterdir()):
            if not entry.is_dir():
                continue
            try:
                bundle = _results_bundle_dir(entry)
            except FileNotFoundError:
                continue
            summary = _run_summary_from_bundle(
                bundle,
                run_id=model_results_run_id(entry.name),
                model_dir=entry.name,
            )
            if summary:
                runs.append(summary)

    runs.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return runs


def _artifact_roots(bundle_dir: Path, run_dir: Path) -> list[Path]:
    """Dirs that may contain ``results.zip`` or ``testResults/`` (bundle or model dir)."""
    roots: list[Path] = []
    for candidate in (bundle_dir, run_dir):
        if candidate not in roots:
            roots.append(candidate)
    return roots


def _load_viewer_from_bundle(bundle_dir: Path, *, run_dir: Path) -> dict[str, Any]:
    results_json = bundle_dir / "results.json"
    doc = _read_results_document(results_json)
    if not doc:
        raise ValueError(f"Invalid results.json in {bundle_dir}")

    risks = _load_risk_taxonomy()
    category_by_id, risk_by_key = _risk_label_maps(risks)

    scenarios: list[dict[str, Any]] = []
    for root in _artifact_roots(bundle_dir, run_dir):
        zip_path = root / "results.zip"
        if zip_path.is_file():
            scenarios = _scenarios_from_zip(zip_path, category_by_id, risk_by_key)
            if scenarios:
                break
    if not scenarios:
        for root in _artifact_roots(bundle_dir, run_dir):
            test_results_dir = root / "testResults"
            scenarios = _scenarios_from_test_results_dir(
                test_results_dir, category_by_id, risk_by_key
            )
            if scenarios:
                break
    if not scenarios:
        raise FileNotFoundError(
            f"No scenario results under {run_dir} "
            "(expected results.zip or testResults/*.json in the model-results folder)"
        )

    try:
        generated_at = datetime.fromtimestamp(
            results_json.stat().st_mtime, tz=timezone.utc
        ).isoformat()
    except OSError:
        generated_at = datetime.now(timezone.utc).isoformat()

    scores = doc.get("scores") if isinstance(doc.get("scores"), list) else []
    return {
        "generatedAt": generated_at,
        "summary": {
            "target": str(doc.get("target") or ""),
            "judge": str(doc.get("judge") or ""),
            "user": str(doc.get("user") or ""),
            "prompts": (
                [str(p) for p in doc["prompts"]]
                if isinstance(doc.get("prompts"), list)
                else []
            ),
            "scores": scores,
        },
        "risks": risks,
        "scenarios": scenarios,
    }


def load_local_run_viewer_data(run_id: str) -> dict[str, Any]:
    """Resolve ``local-model-{model_id}`` to filesystem viewer data under model-results/."""
    model_dir = parse_local_model_run_id(run_id)
    if model_dir:
        return load_model_result_viewer_data(model_dir)
    raise ValueError(f"Unknown local run id: {(run_id or '').strip()}")


def load_model_result_viewer_data(model_dir: str) -> dict[str, Any]:
    """ViewerData-compatible payload (summary scores + per-scenario assessments)."""
    name = _validate_model_dir(model_dir)
    run_dir = model_results_root() / name
    if not run_dir.is_dir():
        raise FileNotFoundError(
            f"Model results directory not found: {run_dir} "
            f"(expected benchmark/data/model-results/{name}/)"
        )
    bundle = _results_bundle_dir(run_dir)
    return _load_viewer_from_bundle(bundle, run_dir=run_dir)
