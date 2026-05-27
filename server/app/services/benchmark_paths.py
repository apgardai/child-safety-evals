import os
from pathlib import Path
from uuid import UUID

_SERVER_ROOT = Path(__file__).resolve().parents[2]


def benchmark_root() -> Path:
    """Resolve benchmark package root (monorepo sibling or Docker /app/benchmark)."""
    candidates: list[Path] = [
        Path("/app/benchmark"),
        _SERVER_ROOT.parent / "benchmark",
        _SERVER_ROOT / "benchmark",
    ]
    env_root = os.getenv("BENCHMARK_ROOT", "").strip()
    if env_root:
        candidates.insert(0, Path(env_root))

    for candidate in candidates:
        if (candidate / "models.json").is_file():
            return candidate
    raise FileNotFoundError(
        "Benchmark directory not found (expected models.json under BENCHMARK_ROOT, "
        "../benchmark, or /app/benchmark)."
    )


def evaluation_workspace_dir(run_id: str | UUID) -> Path:
    """
    Per-run benchmark CLI output + ``.benchmark-run-tmp`` checkpoint directory.

    In Docker, ``benchmark/data`` is often mounted read-only for model-results; use
  ``/app/var/evaluation-workspaces`` (writable). Override with ``EVALUATION_WORKSPACE_ROOT``.
    """
    env_root = os.getenv("EVALUATION_WORKSPACE_ROOT", "").strip()
    if env_root:
        return Path(env_root) / str(run_id)
    if Path("/app/var").is_dir():
        return Path("/app/var/evaluation-workspaces") / str(run_id)
    return benchmark_root() / "data" / "evaluation-workspaces" / str(run_id)


def cli_js_path() -> Path:
    path = benchmark_root() / "packages" / "cli" / "build" / "src" / "cli.js"
    if not path.is_file():
        raise FileNotFoundError(
            "Benchmark CLI is not built. From the benchmark directory run: yarn install && yarn tsbuild"
        )
    return path
