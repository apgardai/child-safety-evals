import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";
import {
  localBenchmarkApiEnabled,
  localBenchmarkApiUnavailable,
} from "lib/localBenchmarkApi";

function getBenchmarkPath(): string {
  return path.resolve(process.cwd(), "..", "benchmark");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!localBenchmarkApiEnabled()) return localBenchmarkApiUnavailable();

  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip files are supported" }, { status: 400 });
  }

  const benchmarkPath = getBenchmarkPath();
  const dataDir = path.join(benchmarkPath, "data");
  if (!existsSync(dataDir)) {
    return NextResponse.json({ error: "Benchmark data directory not found" }, { status: 500 });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  const savedName = `results-uploaded-${ts}-${rand}.zip`;
  const savePath = path.join(dataDir, savedName);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(savePath, buf);

  return NextResponse.json({ file: savedName });
}
