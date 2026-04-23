import axios from "axios";

function normalizeBaseUrl(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

function resolveBaseUrl(): string {
  if (typeof window === "undefined") {
    return normalizeBaseUrl(process.env.INTERNAL_API_URL);
  }
  // Client bundles cannot read INTERNAL_API_URL directly.
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_INTERNAL_API_URL);
}

const requestsClient = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
});

export default requestsClient;
