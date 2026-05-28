/** Dispatched after sign-in so TopNav can refresh without polling on /benchmark. */
export const SESSION_UPDATED_EVENT = "apgard-session-updated";

export function notifySessionUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
}
