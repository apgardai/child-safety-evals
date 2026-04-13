import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-server";

function isProtectedPath(pathname: string): boolean {
  if (
    pathname === "/benchmark" ||
    pathname.startsWith("/benchmark/") ||
    pathname === "/models" ||
    pathname.startsWith("/models/") ||
    pathname === "/scenarios" ||
    pathname.startsWith("/scenarios/")
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  if (!isProtectedPath(pathname)) {
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
  matcher: [
    "/benchmark/:path*",
    "/models/:path*",
    "/scenarios/:path*",
    "/api/run",
    "/api/models",
    "/api/scenarios/:path*",
    "/api/custom-model",
    "/api/env",
  ],
};
