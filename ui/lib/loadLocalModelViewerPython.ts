import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { BenchmarkId } from "data/benchmarks";
import { LOCAL_MODEL_RUN_ID_PREFIX } from "lib/viewerDataApi";

const execFileAsync = promisify(execFile);

const PYTHON_LOADER = `
import json, sys
from app.services.local_benchmark_results import load_model_result_viewer_data
benchmark = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
print(json.dumps(load_model_result_viewer_data(sys.argv[1], benchmark_id=benchmark)))
`;

/** Fresh Python process (picks up latest server code; includes in-progress .benchmark-run-tmp). */
export async function loadLocalModelViewerViaPython(
  modelId: string,
  benchmarkId?: BenchmarkId
): Promise<unknown | null> {
  const id = modelId.trim();
  if (!id) return null;

  const serverDir = path.resolve(process.cwd(), "..", "server");
  const args = ["-c", PYTHON_LOADER, id];
  if (benchmarkId) {
    args.push(benchmarkId);
  }
  try {
    const { stdout } = await execFileAsync("python3", args, {
      cwd: serverDir,
      maxBuffer: 64 * 1024 * 1024,
    });
    const parsed: unknown = JSON.parse(stdout.trim());
    return parsed;
  } catch {
    return null;
  }
}

export function modelIdFromViewerQuery(
  modelId: string | null,
  runId: string | null
): string | null {
  const direct = modelId?.trim();
  if (direct) return direct;

  const rid = runId?.trim() ?? "";
  if (!rid.startsWith(LOCAL_MODEL_RUN_ID_PREFIX)) return null;
  const suffix = rid.slice(LOCAL_MODEL_RUN_ID_PREFIX.length).trim();
  return suffix || null;
}

export function shouldTryPythonViewerFallback(status: number, body: string): boolean {
  if (status !== 404) return false;
  return (
    body.includes("No scenario results") ||
    body.includes(".benchmark-run-tmp") ||
    body.includes("testResults")
  );
}
