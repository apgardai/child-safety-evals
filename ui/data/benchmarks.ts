export type BenchmarkId = "wellbeing" | "csea";

export type BenchmarkDefinition = {
  id: BenchmarkId;
  label: string;
  default?: boolean;
  resultsDir: string;
};

export const BENCHMARKS: BenchmarkDefinition[] = [
  {
    id: "wellbeing",
    label: "Youth Mental Wellbeing",
    default: true,
    resultsDir: "model-results",
  },
  {
    id: "csea",
    label: "CSEA",
    resultsDir: "csea-model-results",
  },
];

export const DEFAULT_BENCHMARK_ID: BenchmarkId = "wellbeing";

export function getBenchmarkDefinition(id: string): BenchmarkDefinition | null {
  const normalized = id.trim() as BenchmarkId;
  return BENCHMARKS.find((b) => b.id === normalized) ?? null;
}
