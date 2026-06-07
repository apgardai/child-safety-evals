import type { NextConfig } from "next";
import path from "node:path";

/** Monorepo root (``child-safety-evals/``) — sibling ``benchmark/`` is traced unless excluded. */
const repoRoot = path.join(__dirname, "..");

/** Paths under ``ui/`` (Next project dir) excluded from serverless bundles. */
const benchmarkTraceExcludes = [
  "../benchmark/data/model-results/**",
  "../benchmark/.yarn/**",
  "../benchmark/data/scenarios.jsonl",
  "../benchmark/data/**/*.zip",
  "../benchmark/data/**/testResults/**",
];

const localBenchmarkApiTraceExcludes = ["../benchmark/**"];

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingExcludes: {
    "/*": benchmarkTraceExcludes,
    "/app/api/custom-model": localBenchmarkApiTraceExcludes,
    "/app/api/run": localBenchmarkApiTraceExcludes,
    "/app/api/env": localBenchmarkApiTraceExcludes,
    "/app/api/scenarios/download": localBenchmarkApiTraceExcludes,
    "/app/api/scenarios/upload": localBenchmarkApiTraceExcludes,
  },
  async redirects() {
    return [
      { source: "/leaderboard", destination: "/", permanent: true },
      { source: "/test-results", destination: "/", permanent: false },
      {
        source: "/test-results/:path*",
        destination: "/",
        permanent: false,
      },
      { source: "/results", destination: "/scenarios", permanent: true },
      {
        source: "/api/results/:path*",
        destination: "/api/scenarios/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
