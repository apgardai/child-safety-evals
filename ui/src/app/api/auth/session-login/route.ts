import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { syncUserToBackend } from "@/lib/backend-sync";

function parseAllowedEmails(): Set<string> | null {
  const raw = process.env.ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? new Set(parts) : null;
}

type Body = { token?: string; name?: string };

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const idToken = typeof body.token === "string" ? body.token.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const auth = getFirebaseAdminAuth();
  let decoded: { uid: string; email?: string };
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const email = decoded.email;
  if (!email) {
    return NextResponse.json(
      { error: "Email claim missing on token (enable email provider / verified email)" },
      { status: 400 }
    );
  }

  const allowed = parseAllowedEmails();
  if (allowed && !allowed.has(email.toLowerCase())) {
    return NextResponse.json({ error: "Email not allowed" }, { status: 403 });
  }

  const displayName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "";

  let synced;
  try {
    synced = await syncUserToBackend({
      firebase_uid: decoded.uid,
      email,
      name: displayName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "User sync failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const expiresInMs = 1000 * 60 * 60 * 24 * 5;
  let sessionCookie: string;
  try {
    sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: expiresInMs });
  } catch {
    return NextResponse.json({ error: "Could not create session" }, { status: 400 });
  }

  const res = NextResponse.json({
    user: {
      id: synced.user.id,
      email: synced.user.email,
      name: synced.user.name,
      accountId: synced.user.account_id,
    },
  });

  res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresInMs / 1000),
  });

  return res;
}
