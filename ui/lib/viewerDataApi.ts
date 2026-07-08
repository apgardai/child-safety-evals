import type { BenchmarkId } from "data/benchmarks";
import { DEFAULT_BENCHMARK_ID } from "data/benchmarks";

/** Filesystem runs: ``local-model-{model_id}`` or ``local-csea-{model_id}``. */
export const LOCAL_MODEL_RUN_ID_PREFIX = "local-model-";
export const LOCAL_CSEA_RUN_ID_PREFIX = "local-csea-";

export function isLocalRunId(runId: string): boolean {
  const rid = runId.trim();
  return (
    rid.startsWith(LOCAL_MODEL_RUN_ID_PREFIX) ||
    rid.startsWith(LOCAL_CSEA_RUN_ID_PREFIX)
  );
}

/** Load viewer data from ``benchmark/data/{resultsDir}/{model_id}/``. */
export function viewerDataRequestForModelId(
  modelId: string,
  benchmarkId: BenchmarkId = DEFAULT_BENCHMARK_ID
): {
  url: string;
  params: { model_id: string; benchmark: BenchmarkId };
} {
  return {
    url: "/api/model-results/viewer-data",
    params: { model_id: modelId, benchmark: benchmarkId },
  };
}

/** FastAPI path + query for loading viewer data for a run id. */
export function viewerDataRequest(runId: string): {
  url: string;
  params?: Record<string, string>;
} {
  if (isLocalRunId(runId)) {
    return {
      url: "/api/model-results/viewer-data",
      params: { runId },
    };
  }
  return {
    url: `/api/evaluation-runs/${encodeURIComponent(runId)}/viewer-data`,
  };
}
