"""Read completed benchmark CLI outputs from ``benchmark/data/{resultsDir}/{model_dir}/``."""

from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.crud.evaluation_runs import _overall_score_pct
from app.services.benchmark_registry import (
    LOCAL_CSEA_RUN_ID_PREFIX,
    LOCAL_MODEL_RUN_ID_PREFIX,
    benchmark_definition,
    default_benchmark_id,
    load_benchmarks_registry,
    load_risk_taxonomy,
    model_results_root,
    model_results_run_id,
    normalize_benchmark_id,
    parse_local_model_run_id,
)

_MODEL_DIR_RE = re.compile(r"^[a-z0-9._-]+$")

# While ``yarn run:model`` / ``cs-bench run`` is in progress, per-test JSON is written here.
_BENCHMARK_RUN_TMP_DIRNAME = ".benchmark-run-tmp"

# Completed runs with ``results/testResults/`` — do not prefer in-progress temp checkpoints.
_SKIP_RUN_TMP_MODEL_DIRS = frozenset({"llama-4-scout"})


def _validate_model_dir(model_dir: str) -> str:
    name = (model_dir or "").strip()
    if not name or not _MODEL_DIR_RE.fullmatch(name):
        raise ValueError("Invalid model results directory name.")
    return name


def is_local_run_id(run_id: str) -> bool:
    return parse_local_model_run_id(run_id) is not None


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
    run_dir: Path | None = None,
    benchmark_id: str | None = None,
) -> dict[str, Any] | None:
    results_json = bundle_dir / "results.json"
    doc = _read_results_document(results_json)
    meta = _read_run_meta(run_dir) if run_dir is not None else None
    if not doc and not meta:
        return None

    scores = doc.get("scores") if isinstance(doc, dict) and isinstance(doc.get("scores"), list) else []
    try:
        mtime = datetime.fromtimestamp(
            results_json.stat().st_mtime, tz=timezone.utc
        ).isoformat()
    except OSError:
        if meta and isinstance(meta.get("started_at"), str):
            mtime = meta["started_at"]
        else:
            mtime = datetime.now(timezone.utc).isoformat()

    judge_model, user_model = _resolve_run_models(doc, meta)
    target = _resolve_target_model(doc, meta)
    overall = _overall_score_pct(doc) if doc else None
    risk_scores = _risk_scores(scores)
    risk_items = _risk_items(scores)
    resolved_benchmark = _resolve_benchmark_id(doc, meta, benchmark_id)

    if overall is None and run_dir is not None and _has_benchmark_run_tmp(run_dir):
        partial_scores = _aggregate_scores_from_tmp(run_dir)
        if partial_scores:
            partial_doc = {"scores": partial_scores}
            overall = _overall_score_pct(partial_doc)
            risk_scores = _risk_scores(partial_scores)
            risk_items = _risk_items(partial_scores)

    return {
        "id": run_id,
        "created_at": mtime,
        "target_model": target,
        "judge_model": judge_model,
        "user_model": user_model,
        "overall_score_pct": overall,
        "risk_scores": risk_scores,
        "risk_items": risk_items,
        "source": "local-file",
        "benchmark": resolved_benchmark,
        "model_dir": model_dir,
        "file_path": str(results_json),
        "in_progress": bool(run_dir is not None and _has_benchmark_run_tmp(run_dir)),
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
        raw = results_json_path.read_text(encoding="utf-8").strip()
        if not raw:
            return None
        parsed = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _read_run_meta(run_dir: Path) -> dict[str, Any] | None:
    """``run-meta.json`` written by ``yarn run:model`` before the CLI starts."""
    path = run_dir / "run-meta.json"
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _resolve_run_models(
    doc: dict[str, Any] | None,
    meta: dict[str, Any] | None,
) -> tuple[str | None, str | None]:
    judge: str | None = None
    user: str | None = None
    if doc:
        if isinstance(doc.get("judge"), str):
            judge = doc["judge"]
        if isinstance(doc.get("user"), str):
            user = doc["user"]
    if meta:
        if not judge and isinstance(meta.get("judge_model"), str):
            judge = meta["judge_model"]
        if not user and isinstance(meta.get("user_model"), str):
            user = meta["user_model"]
    return judge, user


def _resolve_target_model(
    doc: dict[str, Any] | None,
    meta: dict[str, Any] | None,
) -> str | None:
    if doc and isinstance(doc.get("target"), str):
        return doc["target"]
    if meta and isinstance(meta.get("target_model"), str):
        return meta["target_model"]
    return None


def _resolve_benchmark_id(
    doc: dict[str, Any] | None,
    meta: dict[str, Any] | None,
    fallback: str | None = None,
) -> str:
    if doc and isinstance(doc.get("benchmark"), str) and doc["benchmark"].strip():
        return doc["benchmark"].strip()
    if meta and isinstance(meta.get("benchmark"), str) and meta["benchmark"].strip():
        return meta["benchmark"].strip()
    if fallback:
        return fallback
    return default_benchmark_id()


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


def _benchmark_run_tmp_dir(run_dir: Path) -> Path:
    return run_dir / _BENCHMARK_RUN_TMP_DIRNAME


def _has_benchmark_run_tmp(run_dir: Path) -> bool:
    if run_dir.name in _SKIP_RUN_TMP_MODEL_DIRS:
        return False
    tmp_dir = _benchmark_run_tmp_dir(run_dir)
    if not tmp_dir.is_dir():
        return False
    return any(tmp_dir.glob("*.json"))


def _read_test_records_from_dir(results_dir: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not results_dir.is_dir():
        return records
    for path in sorted(results_dir.glob("*.json")):
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(parsed, dict):
            records.append(parsed)
    return records


def _grade_counts(grade: str | None) -> tuple[int, int, int]:
    g = (grade or "").strip().lower()
    return (
        1 if g == "failing" else 0,
        1 if g == "adequate" else 0,
        1 if g == "exemplary" else 0,
    )


def _behavior_counts(grade: str | None, occurrence_count: Any) -> list[int]:
    f, a, e = _grade_counts(grade)
    count = occurrence_count if isinstance(occurrence_count, int) else 0
    return [f, a, e, count]


def _score_row_from_test_record(record: dict[str, Any]) -> dict[str, Any] | None:
    scenario = record.get("scenario") if isinstance(record.get("scenario"), dict) else {}
    seed = scenario.get("seed") if isinstance(scenario.get("seed"), dict) else {}
    risk_category_id = seed.get("riskCategoryId")
    risk_id = seed.get("riskId")
    age_range = seed.get("ageRange")
    if not all(isinstance(x, str) and x for x in (risk_category_id, risk_id, age_range)):
        return None

    assessment = (
        record.get("assessment") if isinstance(record.get("assessment"), dict) else {}
    )
    behavior = (
        record.get("behaviorAssessment")
        if isinstance(record.get("behaviorAssessment"), dict)
        else {}
    )

    def behavior_field(name: str) -> list[int]:
        field = behavior.get(name) if isinstance(behavior.get(name), dict) else {}
        return _behavior_counts(
            field.get("grade") if isinstance(field.get("grade"), str) else None,
            field.get("occurrenceCount"),
        )

    return {
        "riskCategoryId": risk_category_id,
        "riskId": risk_id,
        "ageRange": age_range,
        "prompt": str(record.get("prompt") or "default"),
        "sums": {
            "al": 1,
            "as": list(_grade_counts(
                assessment.get("grade") if isinstance(assessment.get("grade"), str) else None
            )),
            "an": behavior_field("anthropomorphism"),
            "eh": behavior_field("epistemicHumility"),
            "hr": behavior_field("humanRedirection"),
        },
    }


def _aggregate_scores_from_test_records(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        row = _score_row_from_test_record(record)
        if not row:
            continue
        key = (
            f"{row['riskCategoryId']}:{row['riskId']}:"
            f"{row['ageRange']}:{row['prompt']}"
        )
        existing = grouped.get(key)
        if existing is None:
            grouped[key] = row
            continue
        sums = existing["sums"]
        other = row["sums"]
        sums["al"] = int(sums.get("al", 0)) + int(other.get("al", 0))
        for field in ("as", "an", "eh", "hr"):
            a = sums.get(field)
            b = other.get(field)
            if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
                sums[field] = [int(x) + int(y) for x, y in zip(a, b)]
        grouped[key] = existing
    return list(grouped.values())


def _aggregate_scores_from_tmp(run_dir: Path) -> list[dict[str, Any]]:
    tmp_dir = _benchmark_run_tmp_dir(run_dir)
    if not tmp_dir.is_dir():
        return []
    return _aggregate_scores_from_test_records(_read_test_records_from_dir(tmp_dir))


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


def _zip_scenario_entries(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    """``(zip member path, file name)`` for scenario JSON under ``testResults/``."""
    entries: list[tuple[str, str]] = []
    for name in zf.namelist():
        if not name.endswith(".json"):
            continue
        parts = [p for p in name.split("/") if p]
        if len(parts) < 2 or parts[-2].lower() != "testresults":
            continue
        entries.append((name, parts[-1]))
    return entries


def _scenarios_from_zip(
    zip_path: Path,
    category_by_id: dict[str, str],
    risk_by_key: dict[str, str],
) -> list[dict[str, Any]]:
    scenarios: list[dict[str, Any]] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name, file_name in _zip_scenario_entries(zf):
            try:
                raw = zf.read(name).decode("utf-8")
                record = json.loads(raw)
            except (KeyError, json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(record, dict):
                continue
            scenarios.append(
                _normalize_scenario_record(record, file_name, category_by_id, risk_by_key)
            )
    return scenarios


def list_model_result_runs(benchmark_id: str | None = None) -> list[dict[str, Any]]:
    """Summaries for leaderboard (mirrors Next ``/api/model-results``)."""
    runs: list[dict[str, Any]] = []
    benchmark_ids = (
        list(load_benchmarks_registry())
        if (benchmark_id or "").strip().lower() == "all"
        else [normalize_benchmark_id(benchmark_id)]
    )
    for bid in benchmark_ids:
        root = model_results_root(bid)
        if not root.is_dir():
            continue
        for entry in sorted(root.iterdir()):
            if not entry.is_dir():
                continue
            try:
                bundle = _results_bundle_dir(entry)
            except FileNotFoundError:
                continue
            summary = _run_summary_from_bundle(
                bundle,
                run_id=model_results_run_id(entry.name, bid),
                model_dir=entry.name,
                run_dir=entry,
                benchmark_id=bid,
            )
            if summary:
                runs.append(summary)

    runs.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return runs


def _artifact_roots(bundle_dir: Path, run_dir: Path) -> list[Path]:
    """Dirs that may contain ``results.zip`` or ``testResults/``.

    CLI output often has ``results.json`` at the model dir while per-scenario JSON
    lives under ``results/testResults/`` (nested bundle next to a top-level summary).
    """
    roots: list[Path] = []
    for candidate in (bundle_dir, run_dir, run_dir / "results", bundle_dir / "results"):
        if candidate not in roots:
            roots.append(candidate)
    return roots


def _load_viewer_from_bundle(
    bundle_dir: Path,
    *,
    run_dir: Path,
    benchmark_id: str,
) -> dict[str, Any]:
    results_json = bundle_dir / "results.json"
    doc = _read_results_document(results_json)
    meta = _read_run_meta(run_dir)
    if not doc and not meta:
        raise ValueError(f"Invalid results.json in {bundle_dir}")

    resolved_benchmark = _resolve_benchmark_id(doc, meta, benchmark_id)
    risks = load_risk_taxonomy(resolved_benchmark)
    category_by_id, risk_by_key = _risk_label_maps(risks)
    in_progress = False

    scenarios: list[dict[str, Any]] = []
    prefer_test_results = run_dir.name in _SKIP_RUN_TMP_MODEL_DIRS

    if prefer_test_results:
        for root in _artifact_roots(bundle_dir, run_dir):
            test_results_dir = root / "testResults"
            scenarios = _scenarios_from_test_results_dir(
                test_results_dir, category_by_id, risk_by_key
            )
            if scenarios:
                break
        if not scenarios:
            for root in _artifact_roots(bundle_dir, run_dir):
                zip_path = root / "results.zip"
                if zip_path.is_file():
                    scenarios = _scenarios_from_zip(
                        zip_path, category_by_id, risk_by_key
                    )
                    if scenarios:
                        break
    else:
        if _has_benchmark_run_tmp(run_dir):
            tmp_dir = _benchmark_run_tmp_dir(run_dir)
            scenarios = _scenarios_from_test_results_dir(
                tmp_dir, category_by_id, risk_by_key
            )
            if scenarios:
                in_progress = True

        if not scenarios:
            for root in _artifact_roots(bundle_dir, run_dir):
                zip_path = root / "results.zip"
                if zip_path.is_file():
                    scenarios = _scenarios_from_zip(
                        zip_path, category_by_id, risk_by_key
                    )
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
            "(expected results.zip or testResults/*.json under the model dir, "
            "a nested results/ folder, results/testResults/, or "
            f"{_BENCHMARK_RUN_TMP_DIRNAME}/ while the benchmark CLI is running)"
        )

    try:
        generated_at = datetime.fromtimestamp(
            results_json.stat().st_mtime, tz=timezone.utc
        ).isoformat()
    except OSError:
        generated_at = datetime.now(timezone.utc).isoformat()

    scores = (
        doc.get("scores")
        if isinstance(doc, dict) and isinstance(doc.get("scores"), list)
        else []
    )
    if in_progress and not scores:
        scores = _aggregate_scores_from_tmp(run_dir)
    judge_model, user_model = _resolve_run_models(doc, meta)
    prompts: list[str] = []
    if isinstance(doc, dict) and isinstance(doc.get("prompts"), list):
        prompts = [str(p) for p in doc["prompts"]]
    elif meta and isinstance(meta.get("prompts"), list):
        prompts = [str(p) for p in meta["prompts"]]

    return {
        "generatedAt": generated_at,
        "inProgress": in_progress,
        "benchmark": resolved_benchmark,
        "summary": {
            "target": str(_resolve_target_model(doc, meta) or ""),
            "judge": judge_model or "",
            "user": user_model or "",
            "prompts": prompts,
            "scores": scores,
            "benchmark": resolved_benchmark,
        },
        "risks": risks,
        "scenarios": scenarios,
    }


def load_local_run_viewer_data(run_id: str) -> dict[str, Any]:
    """Resolve ``local-model-{model_id}`` / ``local-csea-{model_id}`` viewer data."""
    parsed = parse_local_model_run_id(run_id)
    if parsed:
        model_dir, benchmark_id = parsed
        return load_model_result_viewer_data(model_dir, benchmark_id=benchmark_id)
    raise ValueError(f"Unknown local run id: {(run_id or '').strip()}")


def _model_slug_token_key(slug: str) -> str:
    parts = [p for p in re.split(r"[^a-z0-9]+", slug.lower()) if p]
    return "-".join(sorted(parts))


def _resolve_model_dir_name(model_dir: str, benchmark_id: str) -> str:
    """Map URL slugs to an on-disk model dir (token-order insensitive)."""
    name = _validate_model_dir(model_dir)
    root = model_results_root(benchmark_id)
    if (root / name).is_dir():
        return name
    key = _model_slug_token_key(name)
    if not key:
        return name
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        if _model_slug_token_key(entry.name) == key:
            return entry.name
    return name


def load_model_result_viewer_data(
    model_dir: str,
    *,
    benchmark_id: str | None = None,
) -> dict[str, Any]:
    """ViewerData-compatible payload (summary scores + per-scenario assessments)."""
    bid = normalize_benchmark_id(benchmark_id)
    name = _resolve_model_dir_name(model_dir, bid)
    run_dir = model_results_root(bid) / name
    if not run_dir.is_dir():
        raise FileNotFoundError(
            f"Model results not found for benchmark '{bid}' "
            f"(expected benchmark/data/{benchmark_definition(bid)['resultsDir']}/{name}/)"
        )
    bundle = _results_bundle_dir(run_dir)
    return _load_viewer_from_bundle(bundle, run_dir=run_dir, benchmark_id=bid)
