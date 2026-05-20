"""Build viewer-data payloads from benchmark results archives (Python port of ui/lib/viewerDataFromZip)."""

from __future__ import annotations

import json
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any


def _build_risk_maps(risks: list[dict[str, Any]] | None) -> tuple[dict[str, str], dict[str, str]]:
    category_by_id: dict[str, str] = {}
    risk_by_key: dict[str, str] = {}
    for category in risks or []:
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
    record: Any,
    file_name: str,
    category_by_id: dict[str, str],
    risk_by_key: dict[str, str],
) -> dict[str, Any]:
    r = record if isinstance(record, dict) else {}
    scenario = r.get("scenario") if isinstance(r.get("scenario"), dict) else {}
    seed = scenario.get("seed") if isinstance(scenario.get("seed"), dict) else {}
    assessment = r.get("assessment") if isinstance(r.get("assessment"), dict) else {}

    risk_category_id = seed.get("riskCategoryId") if isinstance(seed.get("riskCategoryId"), str) else ""
    risk_id = seed.get("riskId") if isinstance(seed.get("riskId"), str) else ""
    risk_key = f"{risk_category_id}:{risk_id}"

    messages_raw = r.get("messages") if isinstance(r.get("messages"), list) else []
    messages = []
    for m in messages_raw:
        if not isinstance(m, dict):
            continue
        messages.append(
            {
                "role": m.get("role") if isinstance(m.get("role"), str) else "",
                "content": m.get("content") if isinstance(m.get("content"), str) else "",
            }
        )

    motivation = seed.get("motivation") if isinstance(seed.get("motivation"), dict) else {}
    return {
        "file": file_name,
        "id": seed.get("id") if isinstance(seed.get("id"), str) else file_name,
        "prompt": r.get("prompt") if isinstance(r.get("prompt"), str) else "default",
        "riskCategoryId": risk_category_id,
        "riskCategoryName": category_by_id.get(risk_category_id) or risk_category_id or "Unknown",
        "riskId": risk_id,
        "riskName": risk_by_key.get(risk_key) or risk_id or "Unknown",
        "ageRange": seed.get("ageRange") if isinstance(seed.get("ageRange"), str) else "",
        "scenarioTitle": (
            (scenario.get("shortTitle") if isinstance(scenario.get("shortTitle"), str) else "")
            or (seed.get("shortTitle") if isinstance(seed.get("shortTitle"), str) else "")
            or "Untitled scenario"
        ),
        "narrative": scenario.get("narrative") if isinstance(scenario.get("narrative"), str) else "",
        "evaluationCriteria": (
            scenario.get("evaluationCriteria")
            if isinstance(scenario.get("evaluationCriteria"), str)
            else ""
        ),
        "firstUserMessage": (
            scenario.get("firstUserMessage")
            if isinstance(scenario.get("firstUserMessage"), str)
            else ""
        ),
        "motivationName": motivation.get("name") if isinstance(motivation.get("name"), str) else "",
        "safetyGrade": assessment.get("grade") if isinstance(assessment.get("grade"), str) else "",
        "assessmentReasons": (
            assessment.get("reasons") if isinstance(assessment.get("reasons"), str) else ""
        ),
        "messages": messages,
    }


def _is_summary_payload(obj: Any) -> bool:
    return isinstance(obj, dict) and isinstance(obj.get("scores"), list)


def extract_results_document_from_zip(zip_bytes: bytes) -> dict[str, Any] | None:
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        root_json_paths = [
            n
            for n in zf.namelist()
            if "/" not in n.rstrip("/") and n.endswith(".json")
        ]
        for name in root_json_paths:
            try:
                parsed = json.loads(zf.read(name).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if _is_summary_payload(parsed):
                return parsed
        for name in root_json_paths:
            try:
                parsed = json.loads(zf.read(name).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if isinstance(parsed, dict):
                return parsed
    return None


def build_viewer_data_from_results_zip(
    zip_bytes: bytes,
    *,
    risks_json: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    category_by_id, risk_by_key = _build_risk_maps(risks_json)

    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        paths = [n for n in zf.namelist() if not n.endswith("/")]
        root_json_paths = [p for p in paths if "/" not in p and p.endswith(".json")]

        summary_obj: Any = None
        for name in root_json_paths:
            try:
                parsed = json.loads(zf.read(name).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if _is_summary_payload(parsed):
                summary_obj = parsed
                break
        if summary_obj is None and root_json_paths:
            try:
                summary_obj = json.loads(zf.read(root_json_paths[0]).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                summary_obj = None

        test_prefix = next(
            (p for p in ("testResults/", "testresults/") if any(x.startswith(p) for x in paths)),
            "testResults/",
        )
        test_json_paths = [
            p
            for p in paths
            if p.startswith(test_prefix)
            and p.endswith(".json")
            and "/" not in p[len(test_prefix) :]
        ]

        scenarios: list[dict[str, Any]] = []
        for rel in test_json_paths:
            try:
                parsed = json.loads(zf.read(rel).decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            scenarios.append(
                _normalize_scenario_record(
                    parsed,
                    rel.split("/")[-1],
                    category_by_id,
                    risk_by_key,
                )
            )

    if not root_json_paths and not test_json_paths:
        raise ValueError(
            "Zip does not look like a benchmark results archive "
            "(expected summary .json at root and testResults/*.json)."
        )

    summary = summary_obj if isinstance(summary_obj, dict) else {}
    prompts = summary.get("prompts")
    if not isinstance(prompts, list):
        prompts = []
    else:
        prompts = [str(p) for p in prompts]

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "target": summary.get("target") if isinstance(summary.get("target"), str) else "",
            "judge": summary.get("judge") if isinstance(summary.get("judge"), str) else "",
            "user": summary.get("user") if isinstance(summary.get("user"), str) else "",
            "prompts": prompts,
            "scores": summary.get("scores") if isinstance(summary.get("scores"), list) else [],
        },
        "scenarios": scenarios,
    }


def load_risks_json(benchmark_dir: Path | None = None) -> list[dict[str, Any]] | None:
    root = benchmark_dir or Path(__file__).resolve().parents[2] / "benchmark"
    for base in (root, root.parent / "benchmark", Path("/app/benchmark")):
        path = base / "packages" / "benchmark" / "data" / "risks.json"
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data if isinstance(data, list) else None
            except (json.JSONDecodeError, OSError):
                return None
    return None
