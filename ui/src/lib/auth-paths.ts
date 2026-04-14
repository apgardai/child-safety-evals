/**
 * Whether a pathname requires a session cookie. Keep matcher entries in `middleware.ts`
 * in sync (every path that returns true here should be listed there).
 */
export function requiresAuthPathname(pathname: string): boolean {
  if (
    pathname === "/benchmark" ||
    pathname.startsWith("/benchmark/") ||
    pathname === "/models" ||
    pathname.startsWith("/models/") ||
    pathname === "/scenarios" ||
    pathname.startsWith("/scenarios/") ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/leaderboard/") ||
    pathname === "/test-results" ||
    pathname.startsWith("/test-results/")
  ) {
    return true;
  }
  if (
    pathname.startsWith("/api/run") ||
    pathname.startsWith("/api/models") ||
    pathname.startsWith("/api/scenarios") ||
    pathname.startsWith("/api/custom-model") ||
    pathname.startsWith("/api/env")
  ) {
    return true;
  }
  return false;
}
