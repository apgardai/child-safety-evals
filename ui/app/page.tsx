import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-brand-dark md:text-4xl">
          <span className="text-gradient">Youth Mental Wellbeing</span>
          <br />
          Evaluations
        </h1>
        <p className="text-lg leading-relaxed text-[var(--muted)]">
          Benchmark tooling and scenario review for youth mental wellbeing evaluations. Sign in from
          the top bar to run pipelines against your gateway credentials and explore results.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/leaderboard" className="apgard-btn-secondary">
            View leaderboard
          </Link>
          <Link href="/sign-in?next=/benchmark" className="apgard-btn-primary">
            Run evaluations
          </Link>
        </div>
        <p className="pt-2 text-xs text-[var(--muted)]">
          The benchmark runner and related APIs require authentication.
        </p>
      </div>
    </div>
  );
}
