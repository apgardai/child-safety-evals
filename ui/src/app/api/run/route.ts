import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { NextRequest, NextResponse } from "next/server";

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

  const args = buildArgs(body);
  const bodyWithKey = body as RunRequestBody & {
    apiKey?: string;
    customApiKey?: string;
  };
  const apiKey = typeof bodyWithKey.apiKey === "string" ? bodyWithKey.apiKey.trim() : "";
  const customApiKey =
    typeof bodyWithKey.customApiKey === "string"
      ? bodyWithKey.customApiKey.trim()
      : "";
  const envFromFile = parseEnvFile(envPath);
  const useInMemoryEnv = apiKey.length > 0 || customApiKey.length > 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => {
        controller.enqueue(encoder.encode(text));
      };

      const nodeArgs = useInMemoryEnv
        ? [cliPath, ...args]
        : ["--env-file=" + envPath, cliPath, ...args];
      const spawnEnv = useInMemoryEnv
        ? {
            ...process.env,
            ...envFromFile,
            ...(apiKey ? { AI_GATEWAY_API_KEY: apiKey } : {}),
            ...(customApiKey ? { APGARD_API_KEY: customApiKey } : {}),
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
        controller.close();
      });

      child.on("close", (code, signal) => {
        if (signal) send(`\nProcess killed: ${signal}\n`);
        else if (code != null && code !== 0) send(`\nExit code: ${code}\n`);
        controller.close();
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

export async function GET() {
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
        output: "string (default: data/results.json)",
        prompts: `array of: ${PROMPTS.join(", ")}`,
      },
    },
  });
}
