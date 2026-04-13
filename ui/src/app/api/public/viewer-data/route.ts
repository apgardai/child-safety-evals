import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { NextResponse } from "next/server";

function viewerDataJsonPath(): string {
  return path.join(
    path.resolve(process.cwd(), "..", "benchmark"),
    "results-viewer",
    "data",
    "viewer-data.json"
  );
}

/**
 * Public read of archived viewer bundle (same file as static results-viewer).
 * Does not include live zip from benchmark/data.
 */
export async function GET() {
  const filePath = viewerDataJsonPath();
  if (!existsSync(filePath)) {
    return NextResponse.json(
      {
        error:
          "No viewer-data.json found. From child-safety-evals/benchmark run: node ./results-viewer/build-viewer-data.mjs",
      },
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
