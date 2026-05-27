"""Run the Node benchmark CLI as a subprocess (used by Celery evaluation tasks)."""

from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from collections.abc import Callable

BENCHMARK_CANCELLED_MESSAGE = "Evaluation cancelled."
from dataclasses import dataclass
from pathlib import Path

from app.services.benchmark_paths import (
    benchmark_root,
    cli_js_path,
    evaluation_workspace_dir,
)
from app.services.viewer_data import (
    build_viewer_data_from_results_zip,
    extract_results_document_from_zip,
    load_risks_json,
)

CSE_ZIP_B64_START = "\n__CSE_RESULTS_ZIP_B64_START__\n"
CSE_ZIP_B64_END = "\n__CSE_RESULTS_ZIP_B64_END__\n"


@dataclass
class BenchmarkRunOutput:
    success: bool
    log: str
    results: dict | None = None
    viewer_data: dict | None = None
    error: str | None = None


class _PipeResultsLogFilter:
    """Hide the large base64 zip block from user-visible logs."""

    def __init__(self) -> None:
        self._pending = ""
        self._phase = "before"

    def feed(self, chunk: str) -> str:
        self._pending += chunk
        if self._phase == "after":
            out = self._pending
            self._pending = ""
            return out
        if self._phase == "before":
            i = self._pending.find(CSE_ZIP_B64_START)
            if i == -1:
                tail_keep = max(0, len(self._pending) - (len(CSE_ZIP_B64_START) - 1))
                emit = self._pending[:tail_keep]
                self._pending = self._pending[tail_keep:]
                return emit
            emit = self._pending[:i]
            self._pending = self._pending[i + len(CSE_ZIP_B64_START) :]
            self._phase = "inB64"
            return emit + self._drain_b64()
        return self._drain_b64()

    def _drain_b64(self) -> str:
        j = self._pending.find(CSE_ZIP_B64_END)
        if j == -1:
            return ""
        self._pending = self._pending[j + len(CSE_ZIP_B64_END) :]
        self._phase = "after"
        note = "[Results archive emitted — omitted from log]\n"
        rest = self._pending
        self._pending = ""
        return note + rest

    def finish(self) -> str:
        if self._phase == "inB64":
            return "[Results archive emitted — omitted from log]\n"
        return self.feed("")


def _parse_env_file(env_path: Path) -> dict[str, str]:
    if not env_path.is_file():
        return {}
    out: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        if "=" not in t:
            continue
        k, _, v = t.partition("=")
        out[k.strip()] = v.strip()
    return out


def _extract_zip_base64(stdout: str) -> bytes | None:
    start = stdout.find(CSE_ZIP_B64_START)
    if start == -1:
        return None
    end = stdout.find(CSE_ZIP_B64_END, start + len(CSE_ZIP_B64_START))
    if end == -1:
        return None
    b64 = stdout[start + len(CSE_ZIP_B64_START) : end].replace("\r", "").replace("\n", "")
    if not b64:
        return None
    return base64.b64decode(b64)


def run_benchmark_evaluation(
    *,
    target_model: str,
    judge_model: str,
    user_model: str,
    scenarios_input: str = "data/scenarios.jsonl",
    prompts: list[str] | None = None,
    run_id: str | None = None,
    ai_gateway_api_key: str | None = None,
    custom_api_key: str | None = None,
    custom_api_endpoint: str | None = None,
    custom_parsing_key: str | None = None,
    on_log: Callable[[str], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> BenchmarkRunOutput:
    node = shutil.which("node")
    if not node:
        return BenchmarkRunOutput(
            success=False,
            log="",
            error="Node.js is not installed (required to run the benchmark CLI).",
        )

    try:
        bench_dir = benchmark_root()
        cli_path = cli_js_path()
    except FileNotFoundError as e:
        return BenchmarkRunOutput(success=False, log="", error=str(e))

    prompt_list = prompts if prompts else ["default"]
    if run_id:
        work_dir = evaluation_workspace_dir(run_id)
        work_dir.mkdir(parents=True, exist_ok=True)
        output_path = work_dir / "results.json"
    else:
        output_name = f"cse-results-{uuid.uuid4().hex}.json"
        output_path = Path(tempfile.gettempdir()) / output_name

    args = [
        cli_path.as_posix(),
        "run",
        target_model,
        judge_model,
        user_model,
        "-i",
        scenarios_input,
        "-o",
        output_path.as_posix(),
        "--pipe-results",
        "--prompts",
        ",".join(prompt_list),
    ]

    env = {**os.environ, **_parse_env_file(bench_dir / ".env")}
    if ai_gateway_api_key:
        env["AI_GATEWAY_API_KEY"] = ai_gateway_api_key
    if custom_api_key:
        env["CUSTOM_API_KEY"] = custom_api_key
    if custom_api_endpoint:
        env["CUSTOM_MODEL_API_ENDPOINT"] = custom_api_endpoint
    if custom_parsing_key:
        env["CUSTOM_MODEL_PARSING_KEY"] = custom_parsing_key

    log_filter = _PipeResultsLogFilter()
    stdout_parts: list[str] = []

    def emit_raw(chunk: str) -> None:
        stdout_parts.append(chunk)
        if on_log:
            visible = log_filter.feed(chunk)
            if visible:
                on_log(visible)

    emit_raw(
        f"Starting benchmark CLI: target={target_model}, judge={judge_model}, user={user_model}\n"
    )

    proc = subprocess.Popen(
        [node, *args],
        cwd=bench_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    def _stop_process() -> BenchmarkRunOutput:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        tail = log_filter.finish()
        if on_log and tail:
            on_log(tail)
        if on_log:
            on_log(f"\n{BENCHMARK_CANCELLED_MESSAGE}\n")
        return BenchmarkRunOutput(
            success=False,
            log="".join(stdout_parts),
            error=BENCHMARK_CANCELLED_MESSAGE,
        )

    assert proc.stdout is not None
    for line in proc.stdout:
        if should_cancel and should_cancel():
            return _stop_process()
        emit_raw(line)

    if should_cancel and should_cancel():
        return _stop_process()

    return_code = proc.wait()
    tail = log_filter.finish()
    if on_log and tail:
        on_log(tail)

    full_stdout = "".join(stdout_parts)
    log = full_stdout

    if return_code != 0:
        return BenchmarkRunOutput(
            success=False,
            log=log,
            error=f"Benchmark CLI exited with code {return_code}",
        )

    if re.search(r"\bTest failed for key\b", log) or re.search(
        r"\d+\s+tests?\s+failed\b", log, re.I
    ):
        return BenchmarkRunOutput(
            success=False,
            log=log,
            error="One or more benchmark tests failed. Re-run to retry failed scenarios.",
        )

    zip_bytes = _extract_zip_base64(full_stdout)
    if not zip_bytes:
        return BenchmarkRunOutput(
            success=False,
            log=log,
            error="Benchmark finished but no results archive was emitted (--pipe-results).",
        )

    results = extract_results_document_from_zip(zip_bytes)
    if not results:
        return BenchmarkRunOutput(
            success=False,
            log=log,
            error="Could not parse results document from the benchmark archive.",
        )

    try:
        viewer_data = build_viewer_data_from_results_zip(
            zip_bytes,
            risks_json=load_risks_json(bench_dir),
        )
    except ValueError as e:
        viewer_data = None
        log += f"\nNote: viewer-data build failed: {e}\n"
        if on_log:
            on_log(f"\nNote: viewer-data build failed: {e}\n")

    return BenchmarkRunOutput(
        success=True,
        log=log,
        results=results,
        viewer_data=viewer_data,
    )
