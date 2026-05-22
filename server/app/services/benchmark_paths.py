import os
from pathlib import Path

_SERVER_ROOT = Path(__file__).resolve().parents[2]


def benchmark_root() -> Path:
    """Resolve benchmark package root (monorepo sibling or Docker /app/benchmark)."""
    env_root = os.getenv("BENCHMARK_ROOT", "").strip()
    if env_root:
        root = Path(env_root)
        if (root / "models.json").is_file():
            return root

    for candidate in (
        Path("/app/benchmark"),
        _SERVER_ROOT.parent / "benchmark",
        _SERVER_ROOT / "benchmark",
    ):
        if (candidate / "models.json").is_file():
            return candidate
    raise FileNotFoundError(
        "Benchmark directory not found (expected models.json under BENCHMARK_ROOT, "
        "../benchmark, or /app/benchmark)."
    )


def cli_js_path() -> Path:
    path = benchmark_root() / "packages" / "cli" / "build" / "src" / "cli.js"
    if not path.is_file():
        raise FileNotFoundError(
            "Benchmark CLI is not built. From the benchmark directory run: yarn install && yarn tsbuild"
        )
    return path
