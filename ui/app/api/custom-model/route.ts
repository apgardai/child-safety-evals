import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";

function getBenchmarkPath(): string {
  const uiRoot = process.cwd();
  return path.resolve(uiRoot, "..", "benchmark");
}

function getCustomModelPath(): string {
  const benchmarkPath = getBenchmarkPath();
  return path.join(benchmarkPath, "packages", "cli", "src", "models", "customModel.ts");
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const filePath = getCustomModelPath();
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "customModel.ts not found", content: "" }, { status: 200 });
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, content: "" }, { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = (body as { content?: unknown })?.content;
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Body must be { content: string }" }, { status: 400 });
  }

  const filePath = getCustomModelPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, content, "utf-8");
  await fs.rename(tmp, filePath);

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  return PUT(request);
}

