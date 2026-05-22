import { NextRequest, NextResponse } from "next/server";

import { fastApiForward } from "lib/server-fastapi";

/** Proxy to FastAPI ``GET /api/model-results`` (filesystem under ``benchmark/data/model-results/``). */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  try {
    const { status, body, contentType } = await fastApiForward(
      "/api/model-results",
      cookieHeader
    );
    return new NextResponse(body, {
      status,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load model results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
