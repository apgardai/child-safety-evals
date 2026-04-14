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
  let res: Response;
  try {
    res = await fetch("/api/auth/session-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      message: "Network error while contacting the app. Check your connection and try again.",
      retryable: true,
    };
  }

  const j = (await res.json().catch(() => ({}))) as SessionLoginErrorBody;
  if (res.ok) {
    return { ok: true };
  }

  const code = j.code;
  const retryable =
    (res.status === 502 || res.status === 503 || res.status === 504) &&
    (code === "BACKEND_UNREACHABLE" ||
      code === "CONFIG_ERROR" ||
      code === "SYNC_REJECTED" ||
      code === "SYNC_FAILED" ||
      code === undefined);

  const message =
    j.error ||
    (res.status === 502
      ? "Account service unavailable. Start the API server and try again."
      : `Sign-in failed (${res.status})`);

  return { ok: false, message, retryable };
}
