import axios from "axios";

import requestsClient from "lib/requests-client";
import { notifySessionUpdated } from "lib/session-events";

export type SessionLoginErrorBody = {
  error?: string;
  code?: string;
};

export type SessionLoginSuccess = { ok: true };
export type SessionLoginFailure = {
  ok: false;
  message: string;
  /** True when retrying the same sign-in may succeed (e.g. API was temporarily down). */
  retryable: boolean;
};
export type SessionLoginResult = SessionLoginSuccess | SessionLoginFailure;

export async function postSessionLogin(body: {
  token: string;
  name?: string;
}): Promise<SessionLoginResult> {
  let status = 0;
  let j: SessionLoginErrorBody = {};
  try {
    await requestsClient.post("/api/auth/session-login", body, {
      headers: { "Content-Type": "application/json" },
    });
    notifySessionUpdated();
    return { ok: true };
  } catch (error: unknown) {
    if (!axios.isAxiosError<SessionLoginErrorBody>(error)) {
      return {
        ok: false,
        message: "Network error while contacting the app. Check your connection and try again.",
        retryable: true,
      };
    }
    status = error.response?.status ?? 0;
    j = (error.response?.data ?? {}) as SessionLoginErrorBody;
  }

  if (status === 0) {
    return {
      ok: false,
      message: "Network error while contacting the app. Check your connection and try again.",
      retryable: true,
    };
  }
  const code = j.code;
  const retryable =
    (status === 502 || status === 503 || status === 504) &&
    (code === "BACKEND_UNREACHABLE" ||
      code === "CONFIG_ERROR" ||
      code === "SYNC_REJECTED" ||
      code === "SYNC_FAILED" ||
      code === undefined);

  const message =
    j.error ||
    (status === 502
      ? "Account service unavailable. Start the API server and try again."
      : `Sign-in failed (${status})`);

  return { ok: false, message, retryable };
}
