import { NextRequest, NextResponse } from "next/server";

import {
  loadLocalModelViewerViaPython,
  modelIdFromViewerQuery,
  shouldTryPythonViewerFallback,
} from "lib/loadLocalModelViewerPython";
import { localBenchmarkApiEnabled } from "lib/localBenchmarkApi";
import { fastApiForward } from "lib/server-fastapi";

/** Proxy ``GET /api/model-results/viewer-data?model_id=`` to FastAPI. */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const qs = request.nextUrl.searchParams.toString();
  const path = qs ? `/api/model-results/viewer-data?${qs}` : "/api/model-results/viewer-data";

  const modelId = modelIdFromViewerQuery(
    request.nextUrl.searchParams.get("model_id"),
    request.nextUrl.searchParams.get("runId")
  );
  const benchmarkId = request.nextUrl.searchParams.get("benchmark")?.trim() || undefined;

  try {
    const { status, body, contentType } = await fastApiForward(path, cookieHeader);

    if (
      modelId &&
      localBenchmarkApiEnabled() &&
      shouldTryPythonViewerFallback(status, body)
    ) {
      const fallback = await loadLocalModelViewerViaPython(
        modelId,
        benchmarkId as import("data/benchmarks").BenchmarkId | undefined
      );
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
