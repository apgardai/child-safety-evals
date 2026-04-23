import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";
import { cookieAuthFromRequest, fetchLatestViewerDataFromBackend } from "lib/backend-sync";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ evaluation_run_id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const params = await context.params;
    const runId = params.evaluation_run_id?.trim();
    if (!runId) {
      return NextResponse.json({ error: "Missing evaluation run id" }, { status: 400 });
    }
    const viewer = await fetchLatestViewerDataFromBackend(
      auth.session.email,
      cookieAuthFromRequest(request),
      runId
    );
    return NextResponse.json(viewer);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not load viewer data from DB",
      },
      { status: 502 }
    );
  }
}
