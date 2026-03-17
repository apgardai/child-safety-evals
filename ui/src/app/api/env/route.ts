import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";

function getBenchmarkPath(): string {
  const uiRoot = process.cwd();
  return path.resolve(uiRoot, "..", "benchmark");
}

function getEnvPath(): string {
  return path.join(getBenchmarkPath(), ".env");
}

function parseHasKey(content: string): boolean {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    if (k !== "AI_GATEWAY_API_KEY") continue;
    const v = trimmed.slice(eq + 1).trim();
    return v.length > 0;
  }
  return false;
}

function upsertEnvVar(content: string, key: string, value: string): string {
  const lines = content.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) {
    if (next.length && next[next.length - 1].trim() !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  return next.join("\n").replace(/\n{3,}/g, "\n\n");
}

export async function GET() {
  const envPath = getEnvPath();
  if (!existsSync(envPath)) {
    return NextResponse.json({ hasKey: false });
  }
  try {
    const content = readFileSync(envPath, "utf-8");
    return NextResponse.json({ hasKey: parseHasKey(content) });
  } catch (e) {
    return NextResponse.json({ hasKey: false, error: (e as Error).message });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = (body as { apiKey?: unknown })?.apiKey;
  if (typeof apiKey !== "string") {
    return NextResponse.json({ error: "Body must be { apiKey: string }" }, { status: 400 });
  }
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "apiKey must be non-empty" }, { status: 400 });
  }

  const benchmarkPath = getBenchmarkPath();
  const envExamplePath = path.join(benchmarkPath, ".env.example");
  const envPath = path.join(benchmarkPath, ".env");

  await fs.mkdir(path.dirname(envPath), { recursive: true });

  let content = "";
  if (existsSync(envPath)) {
    content = readFileSync(envPath, "utf-8");
  } else if (existsSync(envExamplePath)) {
    content = readFileSync(envExamplePath, "utf-8");
  }

  const next = upsertEnvVar(content, "AI_GATEWAY_API_KEY", trimmed);
  const tmp = envPath + ".tmp";
  await fs.writeFile(tmp, next.endsWith("\n") ? next : next + "\n", "utf-8");
  await fs.rename(tmp, envPath);

  return NextResponse.json({ ok: true, hasKey: true });
}

export async function POST(request: Request) {
  return PUT(request);
}

