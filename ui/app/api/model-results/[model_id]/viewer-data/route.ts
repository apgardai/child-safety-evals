import { NextRequest, NextResponse } from "next/server";

import {
  loadLocalModelViewerViaPython,
  shouldTryPythonViewerFallback,
} from "lib/loadLocalModelViewerPython";
import { localBenchmarkApiEnabled } from "lib/localBenchmarkApi";
import { fastApiForward } from "lib/server-fastapi";

/** Proxy ``GET /api/model-results/{model_id}/viewer-data`` to FastAPI (filesystem model-results). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ model_id: string }> }
) {
  const { model_id } = await context.params;
  const modelId = decodeURIComponent(model_id ?? "").trim();
  if (!modelId) {
    return NextResponse.json({ detail: "Missing model_id" }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  try {
    const { status, body, contentType } = await fastApiForward(
      `/api/model-results/${encodeURIComponent(modelId)}/viewer-data`,
      cookieHeader
    );

    if (localBenchmarkApiEnabled() && shouldTryPythonViewerFallback(status, body)) {
      const fallback = await loadLocalModelViewerViaPython(modelId);
      if (fallback) {
        return NextResponse.json(fallback);
      }
    }

    return new NextResponse(body, {
      status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load viewer data";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
