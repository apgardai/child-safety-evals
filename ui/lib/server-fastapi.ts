/**
 * Server-only calls from Next.js route handlers to the FastAPI app (`INTERNAL_API_URL`).
 * Forwards the browser session cookie so public `/api/*` routes resolve the same user as the client.
 */

function fastApiBaseUrl(): string {
  const base = process.env.INTERNAL_API_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "INTERNAL_API_URL is not set. Next.js route handlers that call FastAPI require it (e.g. POST /api/run)."
    );
  }
  return base;
}

function joinUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${fastApiBaseUrl()}${p}`;
}

export async function fastApiFetchJson<T>(
  path: string,
  cookieHeader: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Cookie: cookieHeader };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(joinUrl(path), {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `FastAPI ${method} ${path} failed: HTTP ${res.status} ${text.slice(0, 800)}`
    );
  }
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

/** Forward a FastAPI response without throwing on non-2xx (for Next.js route proxies). */
export async function fastApiForward(
  path: string,
  cookieHeader: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: string; contentType: string | null }> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Cookie: cookieHeader };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(joinUrl(path), {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text,
    contentType: res.headers.get("content-type"),
  };
}
