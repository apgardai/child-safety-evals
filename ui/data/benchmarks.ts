export type BenchmarkId = "wellbeing" | "csea";

export type BenchmarkDefinition = {
  id: BenchmarkId;
  label: string;
  description: string;
  default?: boolean;
  resultsDir: string;
};

export const BENCHMARKS: BenchmarkDefinition[] = [
  {
    id: "wellbeing",
    label: "Youth Mental Wellbeing",
    description:
      "Mental health and psychosocial safety risks for youth interacting with AI assistants.",
    default: true,
    resultsDir: "model-results",
  },
  {
    id: "csea",
    label: "CSEA",
    description:
      "Child sexual exploitation and abuse (CSEA) risks in youth–AI interactions.",
    resultsDir: "csea-model-results",
  },
];

export const DEFAULT_BENCHMARK_ID: BenchmarkId = "wellbeing";

export function getBenchmarkDefinition(id: string): BenchmarkDefinition | null {
  const normalized = id.trim() as BenchmarkId;
  return BENCHMARKS.find((b) => b.id === normalized) ?? null;
}
