/**
 * Whether a pathname requires a session cookie. Keep matcher entries in `middleware.ts`
 * in sync (every path that returns true here should be listed there).
 * `/` (leaderboard) and `/leaderboard/*` are public (detail pages load public API model-results).
 */
export function requiresAuthPathname(pathname: string): boolean {
  if (
    (pathname.startsWith("/benchmark/") &&
      !pathname.startsWith("/benchmark/runs") &&
      !pathname.startsWith("/benchmark/testResults/")) ||
    pathname === "/models" ||
    pathname.startsWith("/models/") ||
    pathname === "/scenarios" ||
    pathname.startsWith("/scenarios/")
  ) {
    return true;
  }
  if (
    pathname.startsWith("/api/run") ||
    pathname.startsWith("/api/scenarios") ||
    pathname.startsWith("/api/custom-model") ||
    pathname.startsWith("/api/env")
  ) {
    return true;
  }
  return false;
}
