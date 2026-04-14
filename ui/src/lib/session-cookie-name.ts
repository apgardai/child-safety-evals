/** HttpOnly session cookie set by `/api/auth/session-login`. Kept in a standalone module so Edge middleware does not pull in `firebase-admin` / `node:fs`. */
export const SESSION_COOKIE_NAME = "cse_session";
