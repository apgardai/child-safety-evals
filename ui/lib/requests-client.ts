import axios from "axios";

const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8100";

function normalizeBaseUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

function resolveBaseUrl(): string {
  if (typeof window === "undefined") {
    return normalizeBaseUrl(process.env.INTERNAL_API_URL ?? DEFAULT_INTERNAL_API_URL);
  }
  // Client bundles cannot read INTERNAL_API_URL directly.
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_INTERNAL_API_URL);
}

const requestsClient = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
});

export default requestsClient;

/**
 * Absolute URL for same-origin Next.js routes (e.g. streaming `POST /api/run`).
 * Axios ignores `baseURL` when the request URL is absolute.
 */
export function sameOriginApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return p;
  }
  return `${window.location.origin}${p}`;
}
