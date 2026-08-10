"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageContainer } from "components/PageContainer";
import { ScoreBar } from "components/ScoreBar";
import { useSession } from "hooks/useSession";
import requestsClient from "lib/requests-client";

const linkClass = "font-semibold text-[var(--accent)] hover:underline";

type EvaluationRunRow = {
  id: string;
  created_at: string;
  status?: string;
  target_model: string | null;
  overall_score_pct?: number | null;
};

type UserScore = {
  modelLabel: string;
  score: number;
};

function UserModelScoreCard({
  isSignedIn,
  score,
}: {
  isSignedIn: boolean;
  score: UserScore | null;
}) {
  const modelName = score?.modelLabel?.trim() || "????";
  const hoverHint = !isSignedIn
    ? "Sign in to run your model of choice."
    : score
      ? undefined
      : "Run a benchmark to see your score here.";

  const card = (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors group-hover:border-[var(--accent)]/40 group-hover:bg-[var(--gray-100)] md:p-5">
      <div className="space-y-2">
        <h3 className="font-semibold text-[var(--text)]">
          <span>Your model</span>
          <span className="font-normal text-[var(--muted)]"> / </span>
          <span className="font-medium text-[var(--text)]/90">{modelName}</span>
        </h3>
        <ScoreBar score={score?.score ?? null} emptyLabel="XX%" />
      </div>
      {hoverHint ? (
        <p className="mt-3 max-h-0 overflow-hidden text-xs font-medium text-[var(--muted)] opacity-0 transition-all group-hover:max-h-10 group-hover:opacity-100 group-focus-visible:max-h-10 group-focus-visible:opacity-100">
          {hoverHint}
        </p>
      ) : null}
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

  if (score) {
    return (
      <Link
        href="/benchmark/runs"
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        aria-label="View your evaluation runs"
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

export function HomePage() {
  const { authReady, isSignedIn } = useSession();
  const [userScore, setUserScore] = useState<UserScore | null>(null);

  useEffect(() => {
    if (!authReady || !isSignedIn) {
      setUserScore(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await requestsClient.get<{ runs?: EvaluationRunRow[] }>(
          "/api/evaluation-runs",
          { validateStatus: () => true }
        );
        if (cancelled) return;
        const runs = Array.isArray(res.data?.runs) ? res.data.runs : [];
        const scored = runs
          .filter(
            (run) =>
              typeof run.overall_score_pct === "number" &&
              (run.status == null || run.status === "completed")
          )
          .sort((a, b) => {
            const scoreA = a.overall_score_pct ?? -1;
            const scoreB = b.overall_score_pct ?? -1;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        const best = scored[0];
        if (!best || typeof best.overall_score_pct !== "number") {
          setUserScore(null);
          return;
        }
        setUserScore({
          modelLabel: best.target_model?.trim() || "????",
          score: best.overall_score_pct,
        });
      } catch {
        if (!cancelled) setUserScore(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isSignedIn]);

  return (
    <PageContainer className="space-y-10">
      <header className="grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
            apgard Youth AI Safety Benchmark
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
            See how frontier models perform on youth AI safety risks and run our benchmarks for your
            own use case.
          </p>
        </div>
        <div className="min-w-0 lg:justify-self-end lg:w-full lg:max-w-md">
          <UserModelScoreCard isSignedIn={isSignedIn} score={userScore} />
        </div>
      </header>

      <section className="max-w-3xl space-y-4 text-sm leading-relaxed text-[var(--text)] md:text-base">
        <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">Overview</h2>
        <p className="text-[var(--muted)]">
          Model results on youth mental well-being and youth sexual safety, built upon{" "}
          <a
            href="https://korabench.ai/"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            KORA&apos;s
          </a>{" "}
          open-source AI child safety{" "}
          <a
            href="https://github.com/korabench/benchmark"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            benchmark tool
          </a>{" "}
          and extended with our expert-informed taxonomies. Models are rated by highest overall
          benchmark score; select a model to view its risk breakdown and scenario assessments.
        </p>
        <p className="text-[var(--muted)]">
          Sign in to run the benchmarks on your own models{" "}
          <Link href="/sign-in?next=%2Fbenchmark" className={linkClass}>
            here
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/mental-wellbeing" className="apgard-btn-secondary">
            Youth Mental Wellbeing
          </Link>
          <Link href="/sexual-safety" className="apgard-btn-secondary">
            Youth Sexual Safety
          </Link>
        </div>
      </section>
    </PageContainer>
  );
}
