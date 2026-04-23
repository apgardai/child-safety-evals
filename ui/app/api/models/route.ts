import { type NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "lib/auth-server";
import {
  cookieAuthFromRequest,
  deleteModelInBackend,
  listModelsFromBackend,
  upsertModelInBackend,
} from "lib/backend-sync";

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

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const rows = await listModelsFromBackend(cookieAuthFromRequest(request), auth.session.email);
    const registry: ModelRegistry = {};
    for (const row of rows) {
      const optional = row.optional_parameters ?? {};
      registry[row.alias] = {
        model: row.model_id,
        ...(typeof optional.maxTokens === "number" ? { maxTokens: optional.maxTokens } : {}),
        ...(typeof optional.temperature === "number" ? { temperature: optional.temperature } : {}),
        ...(isPlainObject(optional.providerOptions)
          ? { providerOptions: optional.providerOptions as Record<string, Record<string, unknown>> }
          : {}),
      };
    }
    const models = Object.keys(registry).sort();
    const customModels = rows
      .filter((r) => r.is_custom)
      .map((r) => r.alias)
      .sort();
    return NextResponse.json({ models, customModels, registry });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, models: [], customModels: [], registry: {} },
      { status: 200 }
    );
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

  if (!isPlainObject(body) || typeof body.slug !== "string") {
    return NextResponse.json({ error: "Body must be { slug: string, config: object }" }, { status: 400 });
  }

  const slug = body.slug.trim();
  if (!slug) return NextResponse.json({ error: "slug must be non-empty" }, { status: 400 });

  const validated = validateConfig((body as Record<string, unknown>).config);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const optionalParameters: Record<string, unknown> = {};
  if (validated.value.maxTokens != null) optionalParameters.maxTokens = validated.value.maxTokens;
  if (validated.value.temperature != null) optionalParameters.temperature = validated.value.temperature;
  if (validated.value.providerOptions != null) optionalParameters.providerOptions = validated.value.providerOptions;
  const isCustom = slug.startsWith("custom-");
  const customUrl =
    isCustom && typeof optionalParameters.customApiEndpoint === "string"
      ? (optionalParameters.customApiEndpoint as string)
      : null;
  const customApiKey =
    isCustom && typeof optionalParameters.customApiKey === "string"
      ? (optionalParameters.customApiKey as string)
      : null;
  const parsingKey =
    isCustom && typeof optionalParameters.parsingKey === "string"
      ? (optionalParameters.parsingKey as string)
      : null;
  await upsertModelInBackend(
    {
      alias: slug,
      model_id: validated.value.model,
      optional_parameters: optionalParameters,
      is_custom: isCustom,
      custom_url: customUrl,
      custom_api_key: customApiKey,
      parsing_key: parsingKey,
      created_by_email: auth.session.email,
    },
    cookieAuthFromRequest(request)
  );
  const rows = await listModelsFromBackend(cookieAuthFromRequest(request), auth.session.email);
  return NextResponse.json({ ok: true, models: rows.map((r) => r.alias).sort() });
}

export async function POST(request: NextRequest) {
  return PUT(request);
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

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

  await deleteModelInBackend(slug, cookieAuthFromRequest(request), auth.session.email);
  const rows = await listModelsFromBackend(cookieAuthFromRequest(request), auth.session.email);
  return NextResponse.json({ ok: true, models: rows.map((r) => r.alias).sort() });
}
