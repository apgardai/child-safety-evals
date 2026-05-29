/** Dispatched after sign-in or sign-out so TopNav re-fetches `/api/auth/me`. */
export const SESSION_UPDATED_EVENT = "apgard-session-updated";

export function notifySessionUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
}
