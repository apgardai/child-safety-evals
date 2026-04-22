import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import { cookieAuthFromRequest, listEvaluationRunsFromBackend } from "@/lib/backend-sync";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const rows = await listEvaluationRunsFromBackend(
      auth.session.email,
      cookieAuthFromRequest(request)
    );
    return NextResponse.json({ runs: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load evaluation runs", runs: [] },
      { status: 502 }
    );
  }
}
