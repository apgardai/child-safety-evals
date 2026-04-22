import { NextRequest, NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth-server";
import { cookieAuthFromRequest, fetchUserFromBackend } from "@/lib/backend-sync";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchUserFromBackend(session.email, cookieAuthFromRequest(request));
    return NextResponse.json({
      user: data.user,
      account: data.account,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load user";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
