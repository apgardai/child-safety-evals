import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requiresAuthPathname } from "./lib/auth-paths";
import { SESSION_COOKIE_NAME } from "./lib/session-cookie-name";

async function hasActiveSession(request: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(new URL("/api/auth/me", request.url), {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
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
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  // Private pages require an active (verifiable) session, not just cookie presence.
  if (!pathname.startsWith("/api")) {
    const active = await hasActiveSession(request);
    if (!active) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("next", pathname);
      const res = NextResponse.redirect(signIn);
      res.cookies.set(SESSION_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
      });
      return res;
    }
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
    "/benchmark/runs",
    "/benchmark/runs/:path*",
    "/scenarios",
    "/scenarios/:path*",
    "/api/run",
    "/api/models",
    "/api/scenarios/:path*",
    "/api/custom-model",
    "/api/env",
    "/api/evaluation-runs",
    "/api/evaluation-runs/:path*",
    "/api/account/ai-gateway-key",
  ],
};
