/** Filesystem runs: ``local-model-{model_id}`` → ``benchmark/data/model-results/{model_id}/``. */
export const LOCAL_MODEL_RUN_ID_PREFIX = "local-model-";

export function isLocalRunId(runId: string): boolean {
  return runId.trim().startsWith(LOCAL_MODEL_RUN_ID_PREFIX);
}

/** Load viewer data from ``benchmark/data/model-results/{model_id}/``. */
export function viewerDataRequestForModelId(modelId: string): {
  url: string;
  params: { model_id: string };
} {
  return {
    url: "/api/model-results/viewer-data",
    params: { model_id: modelId },
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
