import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "lib/auth-server";
import { getFirebaseAdminAuth } from "lib/firebase-admin";

export async function POST(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (session) {
    try {
      const auth = getFirebaseAdminAuth();
      const decoded = await auth.verifySessionCookie(session, true);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      /* ignore */
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
