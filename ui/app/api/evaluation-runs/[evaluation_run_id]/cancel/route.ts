import { type NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";
import { fastApiForward } from "lib/server-fastapi";

type RouteContext = { params: Promise<{ evaluation_run_id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const { evaluation_run_id } = await context.params;
  const cookie = request.headers.get("cookie") ?? "";

  const upstream = await fastApiForward(
    `/api/evaluation-runs/${encodeURIComponent(evaluation_run_id)}/cancel`,
    cookie,
    { method: "POST", body: {} }
  );

  const headers: Record<string, string> = {};
  if (upstream.contentType) {
    headers["Content-Type"] = upstream.contentType;
  } else if (upstream.body.trim()) {
    headers["Content-Type"] = "application/json";
  }

  return new NextResponse(upstream.body || null, {
    status: upstream.status,
    headers,
  });
}
