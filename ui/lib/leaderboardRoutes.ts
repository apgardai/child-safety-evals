import {
  mainLeaderboardModels,
  otherLeaderboardModels,
  type LeaderboardRow,
} from "data/leaderboardModels";
import type { BenchmarkId } from "data/benchmarks";
import { DEFAULT_BENCHMARK_ID } from "data/benchmarks";

import { LOCAL_MODEL_RUN_ID_PREFIX } from "lib/viewerDataApi";

const allLeaderboardRows: LeaderboardRow[] = [
  ...mainLeaderboardModels,
  ...otherLeaderboardModels,
];

export function leaderboardModelPath(
  modelId: string,
  benchmarkId: BenchmarkId = DEFAULT_BENCHMARK_ID
): string {
  const base = `/leaderboard/${encodeURIComponent(modelId)}`;
  if (benchmarkId === DEFAULT_BENCHMARK_ID) {
    return base;
  }
  return `${base}?benchmark=${encodeURIComponent(benchmarkId)}`;
}

/** CSEA (or other non-default) benchmark preview pages under ``/leaderboard/preview/``. */
export function leaderboardPreviewModelPath(
  modelId: string,
  benchmarkId: BenchmarkId = "csea"
): string {
  const base = `/leaderboard/preview/${encodeURIComponent(modelId)}`;
  if (benchmarkId === DEFAULT_BENCHMARK_ID) {
    return base;
  }
  return `${base}?benchmark=${encodeURIComponent(benchmarkId)}`;
}

export function localModelRunId(modelId: string): string {
  return `${LOCAL_MODEL_RUN_ID_PREFIX}${modelId}`;
}

/** URL segment for a leaderboard card (prefers filesystem ``model_dir`` from the best run). */
export function modelIdForLeaderboardRow(
  row: LeaderboardRow,
  bestRun?: { model_dir?: string | null; target_model?: string | null } | null
): string | null {
  const dir = bestRun?.model_dir?.trim();
  if (dir) return dir;

  const target = (bestRun?.target_model ?? "").trim().toLowerCase();
  if (target) {
    const targets = row.benchmarkTargets ?? [];
    const exact = targets.find((t) => t.toLowerCase() === target);
    if (exact) return exact;
    const partial = targets.find((t) => target.includes(t.toLowerCase()));
    if (partial) return partial;
    return bestRun!.target_model!.trim();
  }

  return row.benchmarkTargets?.[0] ?? null;
}

export function findLeaderboardRowByModelId(modelId: string): LeaderboardRow | null {
  const id = modelId.trim().toLowerCase();
  if (!id) return null;

  for (const row of allLeaderboardRows) {
    const targets = row.benchmarkTargets ?? [];
    if (targets.some((t) => t.toLowerCase() === id)) return row;
  }
  return null;
}

/** Compare slug tokens regardless of segment order (``llama-4-maverick`` ≡ ``llama-maverick-4``). */
function modelSlugTokenKey(slug: string): string {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join("-");
}

function isKnownBenchmarkTarget(slug: string): boolean {
  const id = slug.trim().toLowerCase();
  if (!id) return false;
  return allLeaderboardRows.some((row) =>
    (row.benchmarkTargets ?? []).some((t) => t.toLowerCase() === id)
  );
}

/**
 * Best-effort alias for preview URLs (e.g. ``llama-maverick-4`` → ``llama-4-maverick``).
 * Never rewrites a slug that is already a known benchmark target — that would collapse
 * ``gpt-5.5-high-limited`` to ``gpt-5.5`` and break filesystem lookups.
 */
export function resolveFilesystemModelId(modelId: string): string {
  const id = modelId.trim();
  if (!id || isKnownBenchmarkTarget(id)) return id;

  const key = modelSlugTokenKey(id);
  for (const row of allLeaderboardRows) {
    for (const target of row.benchmarkTargets ?? []) {
      if (modelSlugTokenKey(target) === key) return target;
    }
  }
  return id;
}
