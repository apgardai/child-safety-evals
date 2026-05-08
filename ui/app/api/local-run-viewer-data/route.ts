import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { buildViewerDataFromResultsZip } from "lib/viewerDataFromZip";

function benchmarkRoot(): string {
  return path.resolve(process.cwd(), "..", "benchmark");
}

function decodeRunId(runId: string): string | null {
  const prefix = "local-";
  if (!runId.startsWith(prefix)) return null;
  const b64 = runId.slice(prefix.length);
  try {
    return Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function isAllowedResultsJson(resolvedJson: string, root: string): boolean {
  const dataDir = path.resolve(root, "data");
  const normalized = path.resolve(resolvedJson);
  if (!normalized.startsWith(dataDir + path.sep)) return false;
  return path.basename(normalized) === "results.json";
}

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")?.trim() ?? "";
  if (!runId) {
    return NextResponse.json({ error: "Missing runId query parameter" }, { status: 400 });
  }

  const jsonPath = decodeRunId(runId);
  if (!jsonPath) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  const root = benchmarkRoot();
  const resolvedJson = path.resolve(jsonPath);
  if (!isAllowedResultsJson(resolvedJson, root)) {
    return NextResponse.json(
      { error: "Path is not an allowed benchmark results.json under data/" },
      { status: 403 }
    );
  }

  const zipPath = path.join(path.dirname(resolvedJson), "results.zip");
  try {
    await fs.access(zipPath);
  } catch {
    return NextResponse.json(
      {
        error: `No results.zip next to results.json. Expected: ${zipPath}`,
      },
      { status: 404 }
    );
  }

  let risksJson: unknown;
  const risksPath = path.join(root, "packages", "benchmark", "data", "risks.json");
  try {
    const raw = await fs.readFile(risksPath, "utf-8");
    risksJson = JSON.parse(raw) as unknown;
  } catch {
    risksJson = undefined;
  }

  const buf = await fs.readFile(zipPath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  try {
    const viewerData = await buildViewerDataFromResultsZip(arrayBuffer, {
      risksJson: Array.isArray(risksJson) ? (risksJson as never) : undefined,
    });
    return NextResponse.json(viewerData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse results zip";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
