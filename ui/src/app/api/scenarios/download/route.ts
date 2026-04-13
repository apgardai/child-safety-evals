import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";

function getBenchmarkPath(): string {
  const uiRoot = process.cwd();
  return path.resolve(uiRoot, "..", "benchmark");
}

/** Only allow safe basenames under data/results-*.(json|zip) */
function isAllowedBasename(name: string): boolean {
  if (name.includes("/") || name.includes("..") || name.includes("\\")) return false;
  return /^results-[a-zA-Z0-9._-]+\.(json|zip)$/i.test(name);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const file = request.nextUrl.searchParams.get("file");
  if (!file || !isAllowedBasename(file)) {
    return NextResponse.json({ error: "Invalid file parameter" }, { status: 400 });
  }

  const benchmarkPath = getBenchmarkPath();
  const dataDir = path.join(benchmarkPath, "data");
  const abs = path.join(dataDir, file);
  const rel = path.relative(dataDir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(abs)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buf = await fs.readFile(abs);
  const isZip = file.toLowerCase().endsWith(".zip");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": isZip
        ? "application/zip"
        : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
