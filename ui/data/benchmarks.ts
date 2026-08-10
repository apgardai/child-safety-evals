export type BenchmarkId = "wellbeing" | "csea";

export type BenchmarkDefinition = {
  id: BenchmarkId;
  label: string;
  description: string;
  /** Public leaderboard path for this benchmark. */
  path: string;
  default?: boolean;
  resultsDir: string;
};

export const BENCHMARKS: BenchmarkDefinition[] = [
  {
    id: "wellbeing",
    label: "Youth Mental Wellbeing",
    description:
      "Mental health and psychosocial safety risks for youth interacting with AI assistants.",
    path: "/mental-wellbeing",
    default: true,
    resultsDir: "model-results",
  },
  {
    id: "csea",
    label: "Youth Sexual Safety",
    description:
      "Youth sexual safety risks in youth–AI interactions, including age-inappropriate sexual content and CSEA.",
    path: "/sexual-safety",
    resultsDir: "csea-model-results",
  },
];

export const DEFAULT_BENCHMARK_ID: BenchmarkId = "wellbeing";

export function getBenchmarkDefinition(id: string): BenchmarkDefinition | null {
  const normalized = id.trim() as BenchmarkId;
  return BENCHMARKS.find((b) => b.id === normalized) ?? null;
}

export function getBenchmarkByPath(pathname: string): BenchmarkDefinition | null {
  const path = pathname.replace(/\/$/, "") || "/";
  return BENCHMARKS.find((b) => b.path === path) ?? null;
}
