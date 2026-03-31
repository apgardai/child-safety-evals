import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { NextResponse } from "next/server";

function getBenchmarkPath(): string {
  return path.resolve(process.cwd(), "..", "benchmark");
}

export async function GET() {
  const filePath = path.join(
    getBenchmarkPath(),
    "results-viewer",
    "data",
    "viewer-data.json"
  );

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "viewer-data.json not found. Run benchmark first." },
      { status: 404 }
    );
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    return new NextResponse(raw, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

