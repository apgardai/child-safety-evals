import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import { buildViewerDataFromResultsZip } from "@/lib/viewerDataFromZip";

function getBenchmarkPath(): string {
  return path.resolve(process.cwd(), "..", "benchmark");
}

/** Latest `data/results-*.zip` by modification time (CLI run output). */
function findLatestResultsZipPath(dataDir: string): string | null {
  if (!existsSync(dataDir)) return null;
  let best: string | null = null;
  let bestTime = 0;
  for (const name of readdirSync(dataDir)) {
    if (!/^results-[a-zA-Z0-9._-]+\.zip$/i.test(name)) continue;
    const full = path.join(dataDir, name);
    try {
      const t = statSync(full).mtimeMs;
      if (t >= bestTime) {
        bestTime = t;
        best = full;
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

function readRisksJson(benchmarkPath: string): unknown[] | undefined {
  const risksPath = path.join(
    benchmarkPath,
    "packages",
    "benchmark",
    "data",
    "risks.json"
  );
  if (!existsSync(risksPath)) return undefined;
  try {
    const raw = readFileSync(risksPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isAllowedBasename(name: string): boolean {
  if (name.includes("/") || name.includes("..") || name.includes("\\")) return false;
  return /^results-[a-zA-Z0-9._-]+\.zip$/i.test(name);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const benchmarkPath = getBenchmarkPath();
  const dataDir = path.join(benchmarkPath, "data");
  const reqFile = request.nextUrl.searchParams.get("file");
  const zipPath = reqFile && isAllowedBasename(reqFile)
    ? path.join(dataDir, reqFile)
    : findLatestResultsZipPath(dataDir);

  if (zipPath && existsSync(zipPath)) {
    try {
      const buf = readFileSync(zipPath);
      const arrayBuffer = new Uint8Array(buf).buffer;
      const risksJson = readRisksJson(benchmarkPath);
      const viewer = await buildViewerDataFromResultsZip(arrayBuffer, {
        risksJson,
      } as Parameters<typeof buildViewerDataFromResultsZip>[1]);
      return new NextResponse(JSON.stringify(viewer), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    } catch {
      /* fall through to viewer-data.json */
    }
  }

  const filePath = path.join(
    benchmarkPath,
    "results-viewer",
    "data",
    "viewer-data.json"
  );

  if (!existsSync(filePath)) {
    return NextResponse.json(
      {
        error:
          "No results archive in benchmark/data (results-*.zip) and no viewer-data.json. Run a benchmark first.",
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
