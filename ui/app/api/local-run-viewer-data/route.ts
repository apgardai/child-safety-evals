import { NextRequest, NextResponse } from "next/server";

import { fastApiForward } from "lib/server-fastapi";

import { isLocalRunId } from "lib/viewerDataApi";

/** Proxy to FastAPI viewer-data for ``local-model-{model_id}`` run ids (legacy query param API). */
export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")?.trim() ?? "";
  if (!runId) {
    return NextResponse.json({ error: "Missing runId query parameter" }, { status: 400 });
  }
  if (!isLocalRunId(runId)) {
    return NextResponse.json(
      {
        error:
          "Unsupported runId. Use local-model-{model_id} from the leaderboard or a database run UUID.",
      },
      { status: 400 }
    );
  }

  try {
    const { status, body, contentType } = await fastApiForward(
      `/api/model-results/viewer-data?runId=${encodeURIComponent(runId)}`,
      request.headers.get("cookie") ?? ""
    );
    return new NextResponse(body, {
      status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load viewer data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
