"use client";

import Link from "next/link";

import { BENCHMARKS, type BenchmarkId } from "data/benchmarks";

function toggleClass(active: boolean) {
  return [
    "flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors md:px-4",
    active
      ? "bg-[var(--accent)] text-white"
      : "text-[var(--muted)] hover:text-[var(--color-accent-nav)]",
  ].join(" ");
}

export function BenchmarkToggle({
  activeId,
}: {
  activeId: BenchmarkId;
}) {
  return (
    <div
      className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
      role="tablist"
      aria-label="Benchmark"
    >
      {BENCHMARKS.map((benchmark) => {
        const active = benchmark.id === activeId;
        return (
          <Link
            key={benchmark.id}
            href={benchmark.path}
            role="tab"
            aria-selected={active}
            className={toggleClass(active)}
          >
            {benchmark.label}
          </Link>
        );
      })}
    </div>
  );
}
