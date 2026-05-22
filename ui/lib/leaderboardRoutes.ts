import {
  mainLeaderboardModels,
  otherLeaderboardModels,
  type LeaderboardRow,
} from "data/leaderboardModels";

import { LOCAL_MODEL_RUN_ID_PREFIX } from "lib/viewerDataApi";

const allLeaderboardRows: LeaderboardRow[] = [
  ...mainLeaderboardModels,
  ...otherLeaderboardModels,
];

export function leaderboardModelPath(modelId: string): string {
  return `/leaderboard/${encodeURIComponent(modelId)}`;
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
