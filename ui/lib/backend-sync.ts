import type { NextRequest } from "next/server";

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

/** Auth for server-side calls to FastAPI: session cookie (preferred), ID token (sync-user), or INTERNAL_API_SECRET. */
export type InternalApiAuth =
  | { kind: "cookie"; cookieHeader: string }
  | { kind: "secret" }
  | { kind: "idToken"; idToken: string };

function internalBaseUrl(): string {
  return (process.env.INTERNAL_API_URL ?? DEFAULT_INTERNAL_URL).replace(/\/$/, "");
}

function getInternalSecret(): string {
  const s = process.env.INTERNAL_API_SECRET?.trim();
  if (!s) {
    throw new BackendSyncError(
      "INTERNAL_API_SECRET is not set in the Next.js environment (or pass session cookie auth).",
      "CONFIG_ERROR"
    );
  }
  return s;
}

/** Prefer session cookie when calling the API from a Route Handler. */
export function cookieAuthFromRequest(request: NextRequest): InternalApiAuth {
  const c = request.headers.get("cookie");
  if (c) return { kind: "cookie", cookieHeader: c };
  return { kind: "secret" };
}

function internalAuthHeaders(auth: InternalApiAuth): Record<string, string> {
  if (auth.kind === "cookie") {
    return { Cookie: auth.cookieHeader };
  }
  if (auth.kind === "idToken") {
    return { Authorization: `Bearer ${auth.idToken}` };
  }
  return { "X-Internal-Secret": getInternalSecret() };
}

function jsonHeaders(auth: InternalApiAuth): Record<string, string> {
  return { "Content-Type": "application/json", ...internalAuthHeaders(auth) };
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

export async function syncUserToBackend(
  body: {
    firebase_uid: string;
    email: string;
    name: string;
  },
  auth: InternalApiAuth
): Promise<SyncedUserPayload> {
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/sync-user`, {
      method: "POST",
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        firebase_uid: body.firebase_uid,
        email: body.email,
        name: body.name,
      }),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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

export async function fetchUserFromBackend(
  email: string,
  auth: InternalApiAuth
): Promise<SyncedUserPayload> {
  const u = new URL(`${internalBaseUrl()}/internal/users/me`);
  u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: internalAuthHeaders(auth),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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
export async function persistEvaluationRunToBackend(
  body: {
    email: string;
    results: Record<string, unknown>;
    viewerData?: Record<string, unknown>;
  },
  auth: InternalApiAuth
): Promise<{ id: string }> {
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/evaluation-runs`, {
      method: "POST",
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        email: body.email,
        results: body.results,
        viewer_data: body.viewerData ?? null,
      }),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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
  auth: InternalApiAuth,
  runId?: string
): Promise<Record<string, unknown>> {
  const u = new URL(`${internalBaseUrl()}/internal/evaluation-runs/latest/viewer-data`);
  u.searchParams.set("email", email);
  if (runId) u.searchParams.set("run_id", runId);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: internalAuthHeaders(auth),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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

export async function listModelsFromBackend(
  auth: InternalApiAuth,
  email?: string
): Promise<ModelRegistryRow[]> {
  const u = new URL(`${internalBaseUrl()}/internal/models`);
  if (email) u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: internalAuthHeaders(auth),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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

export async function upsertModelInBackend(
  body: {
    alias: string;
    model_id: string;
    optional_parameters?: Record<string, unknown> | null;
    is_custom?: boolean;
    custom_url?: string | null;
    custom_api_key?: string | null;
    parsing_key?: string | null;
    created_by_email?: string | null;
  },
  auth: InternalApiAuth
): Promise<ModelRegistryRow> {
  let res: Response;
  try {
    res = await fetch(`${internalBaseUrl()}/internal/models`, {
      method: "POST",
      headers: jsonHeaders(auth),
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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
  auth: InternalApiAuth,
  email?: string
): Promise<{ ok: boolean; deleted: boolean }> {
  const u = new URL(`${internalBaseUrl()}/internal/models/${encodeURIComponent(alias)}`);
  if (email) u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      method: "DELETE",
      headers: internalAuthHeaders(auth),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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
  alias: string,
  auth: InternalApiAuth
): Promise<CustomRuntimeConfig> {
  const u = new URL(
    `${internalBaseUrl()}/internal/models/${encodeURIComponent(alias)}/runtime-config`
  );
  u.searchParams.set("email", email);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: internalAuthHeaders(auth),
    });
  } catch (e) {
    if (isUnreachableFetchError(e)) {
      throw new BackendSyncError(
        "The account API did not accept a connection (is the child-safety-evals server running, and INTERNAL_API_URL correct?).",
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
  apiKey: string,
  auth: InternalApiAuth
): Promise<{ ok: boolean }> {
  const res = await fetch(`${internalBaseUrl()}/internal/accounts/ai-gateway-key`, {
    method: "PUT",
    headers: jsonHeaders(auth),
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
  email: string,
  auth: InternalApiAuth
): Promise<AiGatewayKeyStatus> {
  const u = new URL(`${internalBaseUrl()}/internal/accounts/ai-gateway-key/status`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: internalAuthHeaders(auth),
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
  email: string,
  auth: InternalApiAuth
): Promise<{ api_key: string }> {
  const u = new URL(`${internalBaseUrl()}/internal/accounts/ai-gateway-key/runtime`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: internalAuthHeaders(auth),
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
  email: string,
  auth: InternalApiAuth
): Promise<EvaluationRunSummary[]> {
  const u = new URL(`${internalBaseUrl()}/internal/evaluation-runs`);
  u.searchParams.set("email", email);
  const res = await fetch(u.toString(), {
    headers: internalAuthHeaders(auth),
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
