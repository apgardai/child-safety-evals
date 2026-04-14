import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import { fetchLatestViewerDataFromBackend } from "@/lib/backend-sync";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const viewer = await fetchLatestViewerDataFromBackend(auth.session.email);
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
