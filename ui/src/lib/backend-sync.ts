const DEFAULT_INTERNAL_URL = "http://127.0.0.1:8100";

export type SyncedUserPayload = {
  user: {
    id: string;
    email: string;
    name: string;
    firebase_uid: string | null;
    account_id: string;
  };
  account: {
    id: string;
    name: string;
    domain: string | null;
  };
};

export type ModelRegistryRow = {
  id: string;
  alias: string;
  model_id: string;
  optional_parameters?: Record<string, unknown> | null;
  is_custom: boolean;
  custom_url?: string | null;
  parsing_key?: string | null;
};

export type CustomRuntimeConfig = {
  custom_url: string;
  custom_api_key: string;
  parsing_key: string;
};

export type AiGatewayKeyStatus = {
  has_key: boolean;
};

export type EvaluationRunSummary = {
  id: string;
  created_at: string;
  target_model: string | null;
  judge_model: string | null;
  user_model: string | null;
  prompts?: string[] | null;
  num_scores: number;
  overall_score_pct?: number | null;
};

export type BackendSyncFailureCode =
  | "BACKEND_UNREACHABLE"
  | "SYNC_REJECTED"
  | "CONFIG_ERROR";

export class BackendSyncError extends Error {
  constructor(
    message: string,
    public readonly code: BackendSyncFailureCode,
    public readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = "BackendSyncError";
  }
}

function internalBaseUrl(): string {
  return (process.env.INTERNAL_API_URL ?? DEFAULT_INTERNAL_URL).replace(/\/$/, "");
}

function getInternalSecret(): string {
  const s = process.env.INTERNAL_API_SECRET?.trim();
  if (!s) {
    throw new BackendSyncError(
      "INTERNAL_API_SECRET is not set in the Next.js environment.",
      "CONFIG_ERROR"
    );
  }
  return s;
}

function isUnreachableFetchError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  if (
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    (m.includes("fetch") && m.includes("failed"))
  ) {
    return true;
  }
  const c = (e as Error & { cause?: unknown }).cause;
  if (c instanceof Error) {
    const cm = c.message.toLowerCase();
    if (cm.includes("econnrefused") || cm.includes("enotfound") || cm.includes("etimedout")) {
      return true;
    }
  }
  return false;
}

function parseUpstreamErrorBody(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)))
        .join("; ");
    }
  } catch {
    /* use raw */
  }
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

export async function syncUserToBackend(body: {
  firebase_uid: string;
  email: string;
  name: string;
}): Promise<SyncedUserPayload> {
  const secret = getInternalSecret();
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        firebase_uid: body.firebase_uid,
        email: body.email,
        name: body.name,
      }),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "User sync request failed",
      "SYNC_REJECTED"
    );
  }

  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as SyncedUserPayload;
}

export async function fetchUserFromBackend(email: string): Promise<SyncedUserPayload> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/users/me`);
  u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { "X-Internal-Secret": secret },
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Load user request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as SyncedUserPayload;
}

/** Persist benchmark CLI `results.json` payload to the internal API (PostgreSQL). */
export async function persistEvaluationRunToBackend(body: {
  email: string;
  results: Record<string, unknown>;
  viewerData?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const secret = getInternalSecret();
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/evaluation-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        email: body.email,
        results: body.results,
        viewer_data: body.viewerData ?? null,
      }),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Persist evaluation run failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as { id: string };
}

export async function fetchLatestViewerDataFromBackend(
  email: string,
  runId?: string
): Promise<Record<string, unknown>> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/evaluation-runs/latest/viewer-data`);
  u.searchParams.set("email", email);
  if (runId) u.searchParams.set("run_id", runId);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { "X-Internal-Secret": secret },
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Load viewer data request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function listModelsFromBackend(email?: string): Promise<ModelRegistryRow[]> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/models`);
  if (email) u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { "X-Internal-Secret": secret },
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Load models request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as ModelRegistryRow[];
}

export async function upsertModelInBackend(body: {
  alias: string;
  model_id: string;
  optional_parameters?: Record<string, unknown> | null;
  is_custom?: boolean;
  custom_url?: string | null;
  custom_api_key?: string | null;
  parsing_key?: string | null;
  created_by_email?: string | null;
}): Promise<ModelRegistryRow> {
  const secret = getInternalSecret();
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Save model request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as ModelRegistryRow;
}

export async function deleteModelInBackend(
  alias: string,
  email?: string
): Promise<{ ok: boolean; deleted: boolean }> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/models/${encodeURIComponent(alias)}`);
  if (email) u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      method: "DELETE",
      headers: { "X-Internal-Secret": secret },
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Delete model request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as { ok: boolean; deleted: boolean };
}

export async function fetchCustomRuntimeConfigFromBackend(
  email: string,
  alias: string
): Promise<CustomRuntimeConfig> {
  const secret = getInternalSecret();
  const u = new URL(
    `${internalBaseUrl()}/internal/models/${encodeURIComponent(alias)}/runtime-config`
  );
  u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { "X-Internal-Secret": secret },
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running on port 8100, and INTERNAL_API_URL correct?).",
        "BACKEND_UNREACHABLE"
      );
    }
    throw new BackendSyncError(
      e instanceof Error ? e.message : "Load custom runtime config request failed",
      "SYNC_REJECTED"
    );
  }
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as CustomRuntimeConfig;
}

export async function saveAiGatewayApiKeyToBackend(
  email: string,
  apiKey: string
): Promise<{ ok: boolean }> {
  const secret = getInternalSecret();
  const res = await fetch(`${internalBaseUrl()}/internal/accounts/ai-gateway-key`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({
      email,
      api_key: apiKey,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as { ok: boolean };
}

export async function fetchAiGatewayApiKeyStatusFromBackend(
  email: string
): Promise<AiGatewayKeyStatus> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/accounts/ai-gateway-key/status`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: { "X-Internal-Secret": secret },
  });
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as AiGatewayKeyStatus;
}

export async function fetchAiGatewayApiKeyRuntimeFromBackend(
  email: string
): Promise<{ api_key: string }> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/accounts/ai-gateway-key/runtime`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: { "X-Internal-Secret": secret },
  });
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as { api_key: string };
}

export async function listEvaluationRunsFromBackend(
  email: string
): Promise<EvaluationRunSummary[]> {
  const secret = getInternalSecret();
  const u = new URL(`${internalBaseUrl()}/internal/evaluation-runs`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: { "X-Internal-Secret": secret },
  });
  if (!res.ok) {
    const text = await res.text();
    const detail = parseUpstreamErrorBody(res.status, text);
    throw new BackendSyncError(
      detail ? `Account service: ${detail}` : `Account service returned HTTP ${res.status}`,
      "SYNC_REJECTED",
      res.status
    );
  }
  return (await res.json()) as EvaluationRunSummary[];
}
