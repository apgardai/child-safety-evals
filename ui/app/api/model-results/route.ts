import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";

type ScoreRow = {
  sums?: {
    as?: number[];
  };
};

type ResultDocument = {
  target?: string;
  judge?: string;
  user?: string;
  scores?: ScoreRow[];
};

type LocalRiskScore = {
  risk_category_id: string;
  overall_score_pct: number;
};

type LocalRiskItem = {
  risk_category_id: string;
  risk_id: string;
  overall_score_pct: number;
};

type LocalRun = {
  id: string;
  created_at: string;
  target_model: string | null;
  judge_model: string | null;
  user_model: string | null;
  overall_score_pct: number | null;
  risk_scores: LocalRiskScore[];
  risk_items: LocalRiskItem[];
  source: "local-file";
  file_path: string;
};

function benchmarkRoot(): string {
  return path.resolve(process.cwd(), "..", "benchmark");
}

function computeOverallScore(scores: ScoreRow[] | undefined): number | null {
  if (!scores?.length) return null;
  let failing = 0;
  let adequate = 0;
  let exemplary = 0;
  for (const score of scores) {
    const as = score.sums?.as ?? [0, 0, 0];
    failing += as[0] ?? 0;
    adequate += as[1] ?? 0;
    exemplary += as[2] ?? 0;
  }
  const total = failing + adequate + exemplary;
  if (total === 0) return null;
  const points = adequate + exemplary * 2;
  return (points / (total * 2)) * 100;
}

function computeRiskScores(scores: ScoreRow[] | undefined): LocalRiskScore[] {
  if (!scores?.length) return [];
  const grouped = new Map<string, { failing: number; adequate: number; exemplary: number }>();
  for (const row of scores) {
    const categoryId =
      typeof (row as { riskCategoryId?: unknown }).riskCategoryId === "string"
        ? ((row as { riskCategoryId: string }).riskCategoryId || "unknown")
        : "unknown";
    const as = row.sums?.as ?? [0, 0, 0];
    const current = grouped.get(categoryId) ?? { failing: 0, adequate: 0, exemplary: 0 };
    current.failing += as[0] ?? 0;
    current.adequate += as[1] ?? 0;
    current.exemplary += as[2] ?? 0;
    grouped.set(categoryId, current);
  }
  return Array.from(grouped.entries())
    .map(([riskCategoryId, counts]) => {
      const total = counts.failing + counts.adequate + counts.exemplary;
      const score =
        total === 0 ? 0 : ((counts.adequate + counts.exemplary * 2) / (total * 2)) * 100;
      return { risk_category_id: riskCategoryId, overall_score_pct: score };
    })
    .sort((a, b) => b.overall_score_pct - a.overall_score_pct);
}

function computeRiskItems(scores: ScoreRow[] | undefined): LocalRiskItem[] {
  if (!scores?.length) return [];
  return scores
    .map((row) => {
      const as = row.sums?.as ?? [0, 0, 0];
      const failing = as[0] ?? 0;
      const adequate = as[1] ?? 0;
      const exemplary = as[2] ?? 0;
      const total = failing + adequate + exemplary;
      const overallScorePct =
        total === 0 ? 0 : ((adequate + exemplary * 2) / (total * 2)) * 100;
      const riskCategoryId =
        typeof (row as { riskCategoryId?: unknown }).riskCategoryId === "string"
          ? ((row as { riskCategoryId: string }).riskCategoryId || "unknown")
          : "unknown";
      const riskId =
        typeof (row as { riskId?: unknown }).riskId === "string"
          ? ((row as { riskId: string }).riskId || "unknown")
          : "unknown";
      return {
        risk_category_id: riskCategoryId,
        risk_id: riskId,
        overall_score_pct: overallScorePct,
      };
    })
    .sort((a, b) => b.overall_score_pct - a.overall_score_pct);
}

async function readResultFile(filePath: string): Promise<LocalRun | null> {
  try {
    const [raw, stat] = await Promise.all([
      fs.readFile(filePath, "utf-8"),
      fs.stat(filePath),
    ]);
    const parsed = JSON.parse(raw) as ResultDocument;
    return {
      id: `local-${Buffer.from(filePath).toString("base64url")}`,
      created_at: stat.mtime.toISOString(),
      target_model: typeof parsed.target === "string" ? parsed.target : null,
      judge_model: typeof parsed.judge === "string" ? parsed.judge : null,
      user_model: typeof parsed.user === "string" ? parsed.user : null,
      overall_score_pct: computeOverallScore(parsed.scores),
      risk_scores: computeRiskScores(parsed.scores),
      risk_items: computeRiskItems(parsed.scores),
      source: "local-file",
      file_path: filePath,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const root = benchmarkRoot();
  const modelResultsDir = path.join(root, "data", "model-results");
  const defaultResultPath = path.join(root, "data", "results.json");

  const output: LocalRun[] = [];

  try {
    const entries = await fs.readdir(modelResultsDir, { withFileTypes: true });
    const candidateFiles = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(modelResultsDir, entry.name, "results.json"));
    const runs = await Promise.all(candidateFiles.map((candidate) => readResultFile(candidate)));
    for (const run of runs) {
      if (run) output.push(run);
    }
  } catch {
    // Directory may not exist yet.
  }

  const defaultRun = await readResultFile(defaultResultPath);
  if (defaultRun) {
    output.push(defaultRun);
  }

  output.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return NextResponse.json({ runs: output });
}
