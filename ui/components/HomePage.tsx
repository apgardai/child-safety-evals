"use client";

import Link from "next/link";

import { PageContainer } from "components/PageContainer";
import { UserModelScoreCard } from "components/UserModelScoreCard";

const linkClass = "font-semibold text-[var(--accent)] hover:underline";

export function HomePage() {
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
          <UserModelScoreCard />
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
