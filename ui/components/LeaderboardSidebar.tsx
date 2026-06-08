"use client";

import Link from "next/link";
import { useState } from "react";

type SidebarTab = "leaderboard" | "methodology";

const RISK_CATEGORIES = [
  "Nonsuicidal self-injury",
  "Suicide and suicidal ideation",
  "Disordered Eating & Body Dissatisfaction",
  "Psychosocial Distress",
] as const;

function tabButtonClass(active: boolean) {
  return [
    "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
    active
      ? "bg-[var(--accent)] text-white"
      : "text-[var(--muted)] hover:text-[var(--color-accent-nav)]",
  ].join(" ");
}

function LeaderboardTabPanel() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h1 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">Leaderboard</h1>
      <p className="text-[var(--muted)]">
        Model results on youth mental well-being, built upon KORA&apos;s open-source AI child safety
        benchmark tool and extended with our youth mental wellbeing-specific taxonomy. Models are
        ranked by highest composite benchmark score (assistant and child-aware prompt variants
        combined); select a model to view its risk breakdown and scenario assessments.
      </p>
      <p>
        <Link href="/benchmark" className="font-semibold text-[var(--accent)] hover:underline">
          Run the youth mental wellbeing benchmark here.
        </Link>
      </p>
    </div>
  );
}

function MethodologyTabPanel() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h1 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
        How the YouthSafe AI Benchmark works
      </h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Overview</h2>
        <p className="text-[var(--muted)]">
          Young people are increasingly turning to AI for emotional support, yet most evaluations
          do not look closely at youth mental wellbeing. While some benchmarks focus on mental
          health or child safety as umbrella categories, few evaluate fine-grained youth mental
          wellbeing sub-risk categories, which misses some youth developmental needs if not examined
          directly. For example, measurements of how AI responds to a teen asking how to cover
          &ldquo;hypothetical&rdquo; scratches or skipping meals are underrepresented if safety
          categories are too broad. To address this gap, apgard is introducing the YouthSafe AI
          Benchmark for Mental Wellbeing, going deeper on youth mental well-being risks and failure
          modes so builders and policymakers can make better evidence-based decisions to support
          young people and their unique needs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Methodology</h2>
        <p className="text-[var(--muted)]">
          Our benchmark evaluates models against auto-generated youth-AI scenarios driven by our
          clinically-informed taxonomy of youth mental health risks across:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
          {RISK_CATEGORIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-[var(--muted)]">
          Our assessment measures how they address relevant conversation topics, avoid harmful
          advice, recognize crises, and steer youth toward safer outcomes.
        </p>
        <dl className="space-y-3 text-[var(--muted)]">
          <div>
            <dt className="font-semibold text-[var(--text)]">Taxonomy design</dt>
            <dd className="mt-1">
              We synthesized existing child mental health research into a youth- and AI-specific
              risk taxonomy for youth mental well-being.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text)]">Expert review</dt>
            <dd className="mt-1">
              Dozens of child clinicians and youth safety experts reviewed, refined, and validated
              the approach.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text)]">Benchmarking and scoring</dt>
            <dd className="mt-1">
              We ran models on our evaluation sets, computed scores, and shared metrics and failures
              on the leaderboard.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--text)]">Built upon KORA</dt>
            <dd className="mt-1">
              We applied our taxonomy onto KORA&apos;s open-source AI child safety benchmark tool to
              derive this youth mental well-being benchmark.
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--gray-100)] p-4">
        <h2 className="text-base font-semibold text-[var(--text)]">Coming soon</h2>
        <p className="text-[var(--muted)]">
          We are exploring ways to expand our evaluation methods to a multi-session benchmark. For
          child safety, the benchmark should be developmentally aware, trajectory-based, modular,
          and explicitly designed to measure distinct harms like youth mental well-being (and soon
          child sexual exploitation and abuse). Stay tuned for updates on our developments here!
        </p>
      </section>
    </div>
  );
}

export function LeaderboardSidebar() {
  const [tab, setTab] = useState<SidebarTab>("leaderboard");

  return (
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div
        className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
        role="tablist"
        aria-label="Leaderboard information"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "leaderboard"}
          className={tabButtonClass(tab === "leaderboard")}
          onClick={() => setTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "methodology"}
          className={tabButtonClass(tab === "methodology")}
          onClick={() => setTab("methodology")}
        >
          Methodology
        </button>
      </div>

      <div role="tabpanel">
        {tab === "leaderboard" ? <LeaderboardTabPanel /> : <MethodologyTabPanel />}
      </div>
    </aside>
  );
}
