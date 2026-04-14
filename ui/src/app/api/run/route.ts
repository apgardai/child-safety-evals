import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-server";
import {
  fetchAiGatewayApiKeyRuntimeFromBackend,
  fetchCustomRuntimeConfigFromBackend,
  persistEvaluationRunToBackend,
  upsertModelInBackend,
} from "@/lib/backend-sync";
import { buildViewerDataFromResultsZip } from "@/lib/viewerDataFromZip";

function parseEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};
  const raw = readFileSync(envPath, "utf-8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

const AGE_RANGES = ["7to9", "10to12", "13to17"];
const PROMPTS = ["default", "child"];

type GenerateSeedsOptions = {
  command: "generate-seeds";
  model?: string;
  output?: string;
  seedsPerTask?: number;
  ageRanges?: string[];
};

type ExpandScenariosOptions = {
  command: "expand-scenarios";
  model?: string;
  userModel?: string;
  input?: string;
  output?: string;
};

type RunOptions = {
  command: "run";
  targetModel: string;
  customApiKey?: string;
  /** Pass-through only; maps to CUSTOM_MODEL_API_ENDPOINT for custom-* targets */
  customApiEndpoint?: string;
  /** Pass-through only; maps to CUSTOM_MODEL_PARSING_KEY for custom-* targets */
  customParsingKey?: string;
  judgeModel?: string;
  userModel?: string;
  input?: string;
  output?: string;
  prompts?: string[];
};

type RunRequestBody =
  | GenerateSeedsOptions
  | ExpandScenariosOptions
  | RunOptions;

function getBenchmarkPath(): string {
  const uiRoot = process.cwd();
  return path.resolve(uiRoot, "..", "benchmark");
}

function buildArgs(body: RunRequestBody): string[] {
  switch (body.command) {
    case "generate-seeds": {
      const args = [body.model ?? "gpt-4o"];
      if (body.output) args.push("-o", body.output);
      if (body.seedsPerTask != null)
        args.push("--seeds-per-task", String(body.seedsPerTask));
      if (body.ageRanges?.length)
        args.push("--age-ranges", body.ageRanges.join(","));
      return ["generate-seeds", ...args];
    }
    case "expand-scenarios": {
      const args = [body.model ?? "gpt-5.2:high", body.userModel ?? "deepseek-v3.2"];
      if (body.input) args.push("-i", body.input);
      if (body.output) args.push("-o", body.output);
      return ["expand-scenarios", ...args];
    }
    case "run": {
      const args = [
        body.targetModel,
        body.judgeModel ?? "gpt-5.2:high:limited",
        body.userModel ?? "deepseek-v3.2",
      ];
      if (body.input) args.push("-i", body.input);
      if (body.output) args.push("-o", body.output);
      if (body.prompts?.length)
        args.push("--prompts", body.prompts.join(","));
      return ["run", ...args];
    }
    default:
      return [];
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;
  const sessionEmail = auth.session.email;

  let body: RunRequestBody;
  try {
    body = (await request.json()) as RunRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    !body ||
    !("command" in body) ||
    !["generate-seeds", "expand-scenarios", "run"].includes(body.command)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid command: use generate-seeds, expand-scenarios, or run" },
      { status: 400 }
    );
  }

  if (body.command === "run" && !(body as RunOptions).targetModel) {
    return NextResponse.json(
      { error: "run command requires targetModel" },
      { status: 400 }
    );
  }

  const benchmarkPath = getBenchmarkPath();
  const envPath = path.join(benchmarkPath, ".env");
  const cliPath = path.join(benchmarkPath, "packages", "cli", "build", "src", "cli.js");

  if (!existsSync(cliPath)) {
    return NextResponse.json(
      {
        error:
          "Benchmark CLI not built. Build it first from the benchmark directory: cd ../benchmark && yarn install && yarn tsbuild",
        code: "CLI_NOT_BUILT",
        benchmarkPath,
      },
      { status: 503 }
    );
  }

  let runOutputAbsPath: string | null = null;
  if (body.command === "run") {
    const tempBase = `cse-results-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    runOutputAbsPath = path.join(os.tmpdir(), tempBase);
    (body as RunOptions).output = runOutputAbsPath;
  }
  const args = buildArgs(body);
  const bodyWithKey = body as RunRequestBody & {
    apiKey?: string;
    customApiKey?: string;
    customApiEndpoint?: string;
    customParsingKey?: string;
  };
  let apiKey = typeof bodyWithKey.apiKey === "string" ? bodyWithKey.apiKey.trim() : "";
  let customApiKey =
    typeof bodyWithKey.customApiKey === "string"
      ? bodyWithKey.customApiKey.trim()
      : "";
  let customApiEndpoint =
    typeof bodyWithKey.customApiEndpoint === "string"
      ? bodyWithKey.customApiEndpoint.trim()
      : "";
  let customParsingKey =
    typeof bodyWithKey.customParsingKey === "string"
      ? bodyWithKey.customParsingKey.trim()
      : "";

  if (body.command === "run") {
    if (!apiKey) {
      try {
        const rt = await fetchAiGatewayApiKeyRuntimeFromBackend(sessionEmail);
        apiKey = rt.api_key;
      } catch {
        return NextResponse.json(
          {
            error:
              "AI Gateway API key is required. Provide it in the form or save it to your account first.",
          },
          { status: 400 }
        );
      }
    }
    const runBody = body as RunOptions;
    const isCustomTarget = runBody.targetModel.startsWith("custom-");
    if (isCustomTarget) {
      if (!customApiKey || !customApiEndpoint) {
        try {
          const cfg = await fetchCustomRuntimeConfigFromBackend(
            sessionEmail,
            runBody.targetModel
          );
          customApiKey = cfg.custom_api_key;
          customApiEndpoint = cfg.custom_url;
          customParsingKey = customParsingKey || cfg.parsing_key;
        } catch {
          return NextResponse.json(
            {
              error:
                "Custom target model requires customApiKey and customApiEndpoint for first run, or a saved custom model with credentials.",
            },
            { status: 400 }
          );
        }
      }
      try {
        await upsertModelInBackend({
          alias: runBody.targetModel,
          model_id: runBody.targetModel,
          is_custom: true,
          custom_url: customApiEndpoint,
          custom_api_key: customApiKey,
          parsing_key: customParsingKey || "message",
          optional_parameters: {
            parsingKey: customParsingKey || "message",
          },
          created_by_email: sessionEmail,
        });
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? `Could not save custom model in registry: ${e.message}`
                : "Could not save custom model in registry",
          },
          { status: 502 }
        );
      }
    }
  }
  const envFromFile = parseEnvFile(envPath);
  const useInMemoryEnv =
    apiKey.length > 0 || customApiKey.length > 0 || customApiEndpoint.length > 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (text: string) => {
        controller.enqueue(encoder.encode(text));
      };
      const closeOnce = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const nodeArgs = useInMemoryEnv
        ? [cliPath, ...args]
        : ["--env-file=" + envPath, cliPath, ...args];
      const spawnEnv = useInMemoryEnv
        ? {
            ...process.env,
            ...envFromFile,
            ...(apiKey ? { AI_GATEWAY_API_KEY: apiKey } : {}),
            ...(customApiKey ? { CUSTOM_API_KEY: customApiKey } : {}),
            ...(customApiEndpoint
              ? { CUSTOM_MODEL_API_ENDPOINT: customApiEndpoint }
              : {}),
            ...(customParsingKey
              ? { CUSTOM_MODEL_PARSING_KEY: customParsingKey }
              : {}),
          }
        : undefined;

      const child = spawn(process.execPath, nodeArgs, {
        cwd: benchmarkPath,
        env: spawnEnv,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        send(chunk.toString());
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        send(chunk.toString());
      });

      child.on("error", (err) => {
        send(`\nError: ${err.message}\n`);
        closeOnce();
      });

      child.on("close", (code, signal) => {
        void (async () => {
          try {
            if (signal) send(`\nProcess killed: ${signal}\n`);
            else if (code != null && code !== 0) send(`\nExit code: ${code}\n`);
            else if (body.command === "run") {
              const absPath = runOutputAbsPath;
              if (!absPath) {
                closeOnce();
                return;
              }
              if (existsSync(absPath)) {
                const raw = readFileSync(absPath, "utf-8");
                const json = JSON.parse(raw) as Record<string, unknown>;
                const ext = path.extname(absPath);
                const zipPath = (ext ? absPath.slice(0, -ext.length) : absPath) + ".zip";
                let viewerData: Record<string, unknown> | undefined;
                if (existsSync(zipPath)) {
                  try {
                    const zipRaw = readFileSync(zipPath);
                    viewerData = (await buildViewerDataFromResultsZip(
                      new Uint8Array(zipRaw).buffer
                    )) as Record<string, unknown>;
                  } catch (zipErr) {
                    send(
                      `\nNote: results zip could not be parsed for scenario/message ingestion (${
                        zipErr instanceof Error ? zipErr.message : "unknown error"
                      }).\n`
                    );
                  }
                }
                const { id } = await persistEvaluationRunToBackend({
                  email: sessionEmail,
                  results: json,
                  viewerData,
                });
                send(`\nSaved evaluation run to database (id: ${id}).\n`);
                try {
                  rmSync(absPath, { force: true });
                  rmSync(zipPath, { force: true });
                } catch {
                  /* best effort cleanup */
                }
              }
            }
          } catch (e) {
            console.error("[api/run] persist evaluation run:", e);
            send(
              `\nNote: could not save results to the database (${
                e instanceof Error ? e.message : "unknown error"
              }).\n`
            );
          } finally {
            closeOnce();
          }
        })();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    usage: "POST with JSON body: { command, ...options }",
    commands: {
      "generate-seeds": {
        model: "string (default: gpt-4o)",
        output: "string (default: data/scenarioSeeds.jsonl)",
        seedsPerTask: "number (default: 8)",
        ageRanges: `array of: ${AGE_RANGES.join(", ")}`,
      },
      "expand-scenarios": {
        model: "string (default: gpt-5.2:high)",
        userModel: "string (default: deepseek-v3.2)",
        input: "string (default: data/scenarioSeeds.jsonl)",
        output: "string (default: data/scenarios.jsonl)",
      },
      run: {
        targetModel: "string (required)",
        judgeModel: "string (default: gpt-5.2:high:limited)",
        userModel: "string (default: deepseek-v3.2)",
        input: "string (default: data/scenarios.jsonl)",
        prompts: `array of: ${PROMPTS.join(", ")}`,
      },
    },
  });
}
