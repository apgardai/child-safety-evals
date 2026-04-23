import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "lib/auth-server";
import { BackendSyncError, syncUserToBackend } from "lib/backend-sync";
import { getFirebaseAdminAuth } from "lib/firebase-admin";
import { sendLoginNotificationEmail } from "lib/login-notify";

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
    synced = await syncUserToBackend(
      {
        firebase_uid: decoded.uid,
        email,
        name: displayName,
      },
      { kind: "idToken", idToken: idToken }
    );
  } catch (e) {
    if (e instanceof BackendSyncError) {
      if (e.code === "CONFIG_ERROR") {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: 503 }
        );
      }
      if (e.code === "BACKEND_UNREACHABLE") {
        return NextResponse.json(
          {
            error:
              "Cannot reach the account API. Start the child-safety-evals server and align INTERNAL_API_URL. Sync uses a Firebase ID token (no INTERNAL_API_SECRET required).",
            code: e.code,
          },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: e.message, code: e.code }, { status: 502 });
    }
    const msg = e instanceof Error ? e.message : "User sync failed";
    return NextResponse.json({ error: msg, code: "SYNC_FAILED" }, { status: 502 });
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

  const sessionDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresInMs / 1000),
    ...(sessionDomain ? { domain: sessionDomain } : {}),
  });

  // Keep login success independent from email delivery.
  void sendLoginNotificationEmail({
    email: synced.user.email,
    name: synced.user.name,
    uid: decoded.uid,
  }).catch((err) => {
    console.error("[session-login] failed to send login notification email", err);
  });

  return res;
}
