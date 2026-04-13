import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import * as fs from "node:fs/promises";

function getBenchmarkPath(): string {
  const uiRoot = process.cwd();
  return path.resolve(uiRoot, "..", "benchmark");
}

type ModelConfig = {
  model: string;
  maxTokens?: number;
  temperature?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
};

type ModelRegistry = Record<string, ModelConfig>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateConfig(config: unknown): { ok: true; value: ModelConfig } | { ok: false; error: string } {
  if (!isPlainObject(config)) return { ok: false, error: "config must be an object" };
  if (typeof config.model !== "string" || config.model.trim().length === 0) {
    return { ok: false, error: "config.model must be a non-empty string" };
  }
  if (config.maxTokens != null && typeof config.maxTokens !== "number") {
    return { ok: false, error: "config.maxTokens must be a number" };
  }
  if (config.temperature != null && typeof config.temperature !== "number") {
    return { ok: false, error: "config.temperature must be a number" };
  }
  if (config.providerOptions != null) {
    if (!isPlainObject(config.providerOptions)) {
      return { ok: false, error: "config.providerOptions must be an object" };
    }
    for (const [provider, opts] of Object.entries(config.providerOptions)) {
      if (!isPlainObject(opts)) {
        return { ok: false, error: `config.providerOptions.${provider} must be an object` };
      }
    }
  }

  return { ok: true, value: config as ModelConfig };
}

async function readRegistry(modelsPath: string): Promise<ModelRegistry> {
  if (!existsSync(modelsPath)) return {};
  const raw = readFileSync(modelsPath, "utf-8");
  const json = JSON.parse(raw) as unknown;
  if (!isPlainObject(json)) return {};
  return json as ModelRegistry;
}

async function writeRegistry(modelsPath: string, registry: ModelRegistry): Promise<void> {
  const dir = path.dirname(modelsPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = modelsPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2) + "\n", "utf-8");
  await fs.rename(tmp, modelsPath);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const benchmarkPath = getBenchmarkPath();
  const modelsPath = path.join(benchmarkPath, "models.json");

  if (!existsSync(modelsPath)) {
    return NextResponse.json(
      { error: "models.json not found", models: [], registry: {} },
      { status: 200 }
    );
  }

  try {
    const registry = await readRegistry(modelsPath);
    const models = Object.keys(registry).sort();
    return NextResponse.json({ models, registry });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, models: [], registry: {} },
      { status: 200 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const benchmarkPath = getBenchmarkPath();
  const modelsPath = path.join(benchmarkPath, "models.json");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body) || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Body must be { slug: string, config: object }" }, { status: 400 });
  }

  const slug = body.slug.trim();
  if (!slug) return NextResponse.json({ error: "slug must be non-empty" }, { status: 400 });

  const validated = validateConfig((body as Record<string, unknown>).config);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const registry = await readRegistry(modelsPath);
  registry[slug] = validated.value;
  await writeRegistry(modelsPath, registry);

  return NextResponse.json({ ok: true, models: Object.keys(registry).sort() });
}

export async function POST(request: NextRequest) {
  return PUT(request);
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  const benchmarkPath = getBenchmarkPath();
  const modelsPath = path.join(benchmarkPath, "models.json");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body) || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Body must be { slug: string }" }, { status: 400 });
  }

  const slug = body.slug.trim();
  if (!slug) return NextResponse.json({ error: "slug must be non-empty" }, { status: 400 });

  const registry = await readRegistry(modelsPath);
  if (registry[slug] == null) {
    return NextResponse.json({ ok: true, models: Object.keys(registry).sort() });
  }

  delete registry[slug];
  await writeRegistry(modelsPath, registry);
  return NextResponse.json({ ok: true, models: Object.keys(registry).sort() });
}
