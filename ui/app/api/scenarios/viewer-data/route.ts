import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";
import { cookieAuthFromRequest, fetchLatestViewerDataFromBackend } from "lib/backend-sync";

export async function GET(_request: NextRequest) {
  const auth = await requireApiAuth(_request);
  if (!auth.ok) return auth.response;
  try {
    const viewer = await fetchLatestViewerDataFromBackend(
      auth.session.email,
      cookieAuthFromRequest(_request)
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
