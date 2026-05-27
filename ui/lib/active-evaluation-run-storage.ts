/** Persists in-flight evaluation run id per account (browser hint only; server is source of truth). */

export const ACTIVE_EVALUATION_RUN_STORAGE_PREFIX = "cse_active_evaluation_run_id:";
const LEGACY_STORAGE_KEY = "cse_active_evaluation_run_id";

function storageKey(accountId: string): string {
  return `${ACTIVE_EVALUATION_RUN_STORAGE_PREFIX}${accountId}`;
}

export function readStoredEvaluationRunId(
  accountId: string | null | undefined
): string | null {
  if (typeof window === "undefined" || !accountId?.trim()) return null;
  try {
    const id = localStorage
      .getItem(storageKey(accountId.trim()))
      ?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function writeStoredEvaluationRunId(
  accountId: string,
  runId: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(accountId.trim()), runId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredEvaluationRunId(
  accountId: string | null | undefined
): void {
  if (typeof window === "undefined" || !accountId?.trim()) return;
  try {
    localStorage.removeItem(storageKey(accountId.trim()));
  } catch {
    /* ignore */
  }
}

/** Clear all per-account run hints and the legacy global key (e.g. on logout). */
export function clearAllStoredEvaluationRunIds(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(ACTIVE_EVALUATION_RUN_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function clearLegacyStoredEvaluationRunId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
