/** Persists the current evaluation run id across page loads (same browser). */

export const ACTIVE_EVALUATION_RUN_STORAGE_KEY = "cse_active_evaluation_run_id";

export function readStoredEvaluationRunId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(ACTIVE_EVALUATION_RUN_STORAGE_KEY)?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function writeStoredEvaluationRunId(runId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_EVALUATION_RUN_STORAGE_KEY, runId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredEvaluationRunId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_EVALUATION_RUN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
