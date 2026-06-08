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

const linkClass = "font-semibold text-[var(--accent)] hover:underline";

function LeaderboardTabPanel() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">Overview</h2>
      <p className="text-[var(--muted)]">
        Model results on youth mental well-being, built upon{" "}
        <a
          href="https://korabench.ai/"
          className={linkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          KORA&apos;s
        </a>{" "}open-source AI child safety{" "}
        <a
          href="https://github.com/korabench/benchmark"
          className={linkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          benchmark tool
        </a>{" "}
        and extended with our youth mental wellbeing-specific taxonomy. Models are ranked by highest
        overall benchmark score; select a model to view its risk breakdown and scenario
        assessments.
      </p>
      <p>
        <Link href="/benchmark" className={linkClass}>
          Run the youth mental wellbeing benchmark here.
        </Link>
      </p>
      <p>
        <a href="#" className={linkClass}>
          Insights
        </a>
      </p>
      <p className="text-[var(--muted)]">
        Found a bug or have feedback? Reach out to us at{" "}
        <a href="mailto:benchmark@apgardai.com" className={linkClass}>
          benchmark@apgardai.com
        </a>
        .
      </p>
    </div>
  );
}

function MethodologyTabPanel() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
        How the apgard Benchmark works
      </h2>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Overview</h2>
        <p className="text-[var(--muted)]">
          Young people are increasingly turning to AI for emotional support, yet most evaluations
          do not look closely at youth mental wellbeing. While some benchmarks focus on mental
          health or child safety as umbrella categories, few evaluate fine-grained youth mental
          wellbeing sub-risk categories, which misses some youth developmental needs if not examined
          directly. For example, measurements of how AI responds to a teen asking how to cover
          &ldquo;hypothetical&rdquo; scratches or skipping meals are underrepresented if safety
          categories are too broad. To address this gap, apgard is introducing the apgard Benchmark, going deeper on youth mental
          well-being risks and failure
          modes so builders and policymakers can make better evidence-based decisions to support
          young people and their unique needs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Methodology</h2>
        <p className="text-[var(--muted)]">
          Our benchmark evaluates models against auto-generated youth-AI scenarios driven by our
          clinically-informed taxonomy of youth mental health risks across the following high-level
          risk categories:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
          {RISK_CATEGORIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-[var(--muted)]">
          It measures how they address relevant conversation topics, avoid harmful advice, recognize
          crises, and steer youth toward safer outcomes.
        </p>
        <p className="text-[var(--muted)]">
          To conduct the assessment, we incorporated:
        </p>
        <ul className="list-disc space-y-3 pl-5 text-[var(--muted)]">
          <li>
            <span className="font-semibold text-[var(--text)]">
              <a href="https://docs.google.com/spreadsheets/d/1h30gyWQOpKcj-F_h94oHNGWhMuYKlLJfJjapqWz0mWE/edit?usp=sharing" className={linkClass}>
                Taxonomy
              </a>{" "}
              design:
            </span>{" "}
            We synthesized existing child mental health research into a youth- and AI-specific risk
            taxonomy for youth mental well-being.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Expert review:</span> Dozens of child
            clinicians and youth safety experts reviewed, refined, and validated the approach.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">
              Built upon{" "}
              <a href="https://korabench.notion.site/methodology" className={linkClass}>
                KORA
              </a>
              :
            </span>{" "}
            We applied our taxonomy onto KORA&apos;s expert-informed open-source AI child safety{" "}
            <a href="https://github.com/korabench/benchmark" className={linkClass}>
              benchmark tool
            </a>{" "}
            to derive this youth mental well-being benchmark.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Benchmarking and scoring:</span> We
            used various reasoning models (GPT 5.5, GPT 5.4 Mini and Gemini 3.5 Flash) for
            assessment due to their ability to break down nuanced and complex meaning. Scores are
            computed based on KORA&apos;s rubric, and the corresponding metrics are shared on our
            leaderboard. We ran a total of 1380 scenarios across both assistant- and child-aware
            prompts among 21 frontier models.
          </li>
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--gray-100)] p-4">
        <h2 className="text-base font-semibold text-[var(--text)]">Coming soon</h2>
        <p className="text-[var(--muted)]">
          We are exploring ways to expand our evaluation methods to a trajectory-based benchmark.
          As we examine how young people engage with AI and how mental health and CSEA risks can
          emerge, evolve, and accumulate over time, we see a significant gap in current evaluation
          approaches: the ability to assess risk signals longitudinally across repeated interactions
          rather than in isolated conversations. If you would like to help with this critical work,
          please reach out. Stay tuned for updates on our developments here!
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
          Overview
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
