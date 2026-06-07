import { NextResponse } from "next/server";

/** Local dev routes that read/write ``../benchmark`` — disabled on Vercel. */
export function localBenchmarkApiEnabled(): boolean {
  return process.env.VERCEL !== "1";
}

export function localBenchmarkApiUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "This endpoint is only available in local development." },
    { status: 501 }
  );
}
