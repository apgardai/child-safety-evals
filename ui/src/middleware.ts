import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requiresAuthPathname } from "@/lib/auth-paths";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  if (!requiresAuthPathname(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Include index routes explicitly (e.g. `/benchmark`); `/:path*` alone may not match them in some
  // Next.js versions, which would skip middleware for those URLs.
  matcher: [
    "/benchmark",
    "/benchmark/:path*",
    "/models",
    "/models/:path*",
    "/scenarios",
    "/scenarios/:path*",
    "/leaderboard",
    "/leaderboard/:path*",
    "/test-results",
    "/test-results/:path*",
    "/api/run",
    "/api/models",
    "/api/scenarios/:path*",
    "/api/custom-model",
    "/api/env",
  ],
};
