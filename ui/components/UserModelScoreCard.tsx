"use client";

import Link from "next/link";

import { ScoreBar } from "components/ScoreBar";
import { useSession } from "hooks/useSession";

export function UserModelScoreCard() {
  const { isSignedIn } = useSession();
  const hoverHint = isSignedIn
    ? "Run a benchmark to see your score here."
    : "Sign in to run your model of choice.";

  const card = (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors group-hover:border-[var(--accent)]/40 group-hover:bg-[var(--gray-100)] md:p-5">
      <div className="space-y-2">
        <h3 className="font-semibold text-[var(--text)]">
          <span>Your model</span>
          <span className="font-normal text-[var(--muted)]"> / </span>
          <span className="font-medium text-[var(--text)]/90">????</span>
        </h3>
        <ScoreBar score={null} emptyLabel="XX%" />
      </div>
      <p className="mt-3 max-h-0 overflow-hidden text-xs font-medium text-[var(--muted)] opacity-0 transition-all group-hover:max-h-10 group-hover:opacity-100 group-focus-visible:max-h-10 group-focus-visible:opacity-100">
        {hoverHint}
      </p>
    </article>
  );

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in?next=%2Fbenchmark"
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        aria-label="Sign in to run your model of choice"
        title="Sign in to run your model of choice."
      >
        {card}
      </Link>
    );
  }

  return (
    <Link
      href="/benchmark"
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
      aria-label="Run a benchmark on your model"
    >
      {card}
    </Link>
  );
}
