import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import {
  fetchAiGatewayApiKeyStatusFromBackend,
  saveAiGatewayApiKeyToBackend,
} from "@/lib/backend-sync";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  try {
    const status = await fetchAiGatewayApiKeyStatusFromBackend(auth.session.email);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load API key status" },
      { status: 502 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  let body: { apiKey?: string };
  try {
    body = (await request.json()) as { apiKey?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }
  try {
    const out = await saveAiGatewayApiKeyToBackend(auth.session.email, apiKey);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save API key" },
      { status: 502 }
    );
  }
}
