import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const SESSION_COOKIE_NAME = "cse_session";

export type SessionUser = {
  uid: string;
  email: string;
};

export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;
  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(session, true);
    const email = decoded.email;
    if (!email || typeof email !== "string") return null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

export async function requireApiAuth(
  request: NextRequest
): Promise<
  { ok: true; session: SessionUser } | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}
