"use client";

import Link from "next/link";
import { useState } from "react";

import type { BenchmarkId } from "data/benchmarks";

type SidebarTab = "leaderboard" | "methodology";

const WELLBEING_RISK_CATEGORIES = [
  "Nonsuicidal self-injury",
  "Suicide and suicidal ideation",
  "Disordered Eating & Body Dissatisfaction",
  "Psychosocial Distress",
] as const;

const SEXUAL_SAFETY_RISK_CATEGORIES = [
  "Adult Sexual Content Exposure",
  "Sexual Content Involving Minors",
  "Sexual Content Creation & Sexting",
  "Survivor & Disclosure Contexts",
  "Grooming & Predatory Facilitation",
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

function KoraLinks() {
  return (
    <>
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
      </a>
    </>
  );
}

function FeedbackLine() {
  return (
    <p className="text-[var(--muted)]">
      Found a bug or have feedback? Reach out to us at{" "}
      <a href="mailto:benchmark@apgardai.com" className={linkClass}>
        benchmark@apgardai.com
      </a>
      .
    </p>
  );
}

function WellbeingOverviewPanel() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">Overview</h2>
      <p className="text-[var(--muted)]">
        Model results on youth mental well-being, built upon <KoraLinks /> and extended with our
        youth mental wellbeing-specific taxonomy. Models are ranked by highest overall benchmark
        score; select a model to view its risk breakdown and scenario assessments.
      </p>
      <p className="text-[var(--muted)]">
        Run the youth mental wellbeing benchmark{" "}
        <Link href="/benchmark" className={linkClass}>
          here.
        </Link>
      </p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Youth Mental Wellbeing Benchmark Insights
        </h2>
        <p className="text-[var(--muted)]">
          Across all four high-level risk categories (nonsuicidal self-injury, suicide and suicidal
          ideation, disordered eating &amp; body dissatisfaction, psychosocial distress), the
          benchmark shows that the most significant youth mental wellbeing failures are not
          typically caused by overtly unsafe first responses. Instead, many failures emerge through
          gradual alignment with the child&apos;s unsafe framing, where models begin with empathy
          and caution but enable harm through advice, explanations, normalization, secrecy, or
          dependency over subsequent turns.
        </p>
        <p className="text-[var(--muted)]">
          When models are child-aware, their performance improves across all models and risk
          categories, as they tend to activate more protective guardrails and treat requests as
          requiring adult intervention rather than direct help. The largest improvements occur in
          Suicide and suicidal ideation (SSI) and psychosocial distress, while Nonsuicidal
          self-injury (NSSI) remains the most challenging category. For the subrisk categories where
          Assistant scores performed poorly on our benchmark, such as Concealment &amp; Evasion
          (NSSI), Curiosity &amp; Conceptual Engagement (NSSI), and Action Readiness (SSI), even
          with a child-aware prompt, scores remained low.
        </p>
        <p className="text-[var(--muted)]">
          View more insights on the benchmark{" "}
          <a
            href="https://apgardai.substack.com/p/introducing-the-apgard-benchmark"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>
          .
        </p>
      </section>
      <FeedbackLine />
    </div>
  );
}

function SexualSafetyOverviewPanel() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">Overview</h2>
      <p className="text-[var(--muted)]">
        Model results on youth sexual safety, built upon <KoraLinks /> and extended with our youth
        sexual safety-specific taxonomy. Models are ranked by highest overall benchmark score;
        select a model to view its risk breakdown and scenario assessments.
      </p>
      <p className="text-[var(--muted)]">
        Run the youth sexual safety benchmark{" "}
        <Link href="/benchmark" className={linkClass}>
          here.
        </Link>
      </p>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Youth Sexual Safety Benchmark Insights
        </h2>
        <p className="text-[var(--muted)]">
          Across all risk categories, the benchmark reveals that models are better at recognizing
          overtly exploitative requests, such as manipulation and isolation tactics, but often fail
          when requests are ambiguous or framed as an everyday teen problem, such as pose coaching
          for photos. This trend appears in the gap between Adult Sexual Content Exposure and Sexual
          Content Involving Minors. When minors weren&apos;t the subject, models often provided
          explicit sex details that exceeded the age band&apos;s necessary health literacy. When
          minors were the subject, models were better at refusing content that explicitly sexualized
          them and other minors. This reinforces that taxonomies with deeper focus on youth sexual
          safety risks, beyond strict CSEA, are necessary to cover other ways that young people
          engage with AI on sexual topics.
        </p>
        <p className="text-[var(--muted)]">
          The benchmark shows a big difference in performance between proprietary and open-source
          models. For example, Llama 4 Scout and Maverick scored 30-50 points below every
          proprietary model across sub-risks. Models were also three times more likely to fail in
          default Assistant mode than in child-aware mode, where they were instructed they were
          speaking with a child. And 51% of these failures were related to failure of redirecting
          the young persona to a human.
        </p>
        <p className="text-[var(--muted)]">
          View more insights on the youth sexual safety benchmark here.
        </p>
      </section>
      <FeedbackLine />
    </div>
  );
}

function WellbeingMethodologyPanel() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
        How the apgard Youth Mental Wellbeing Benchmark works
      </h2>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Overview</h2>
        <p className="text-[var(--muted)]">
          Young people are increasingly turning to AI for emotional support, yet most evaluations do
          not look closely at youth mental wellbeing. While some benchmarks focus on mental health
          or child safety as umbrella categories, few evaluate fine-grained youth mental wellbeing
          sub-risk categories, which misses some youth developmental needs if not examined directly.
          For example, measurements of how AI responds to a teen asking how to cover
          &ldquo;hypothetical&rdquo; scratches or skipping meals are underrepresented if safety
          categories are too broad. To address this gap, apgard is introducing the apgard Benchmark,
          going deeper on youth mental well-being risks and failure modes so builders and
          policymakers can make better evidence-based decisions to support young people and their
          unique needs.
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
          {WELLBEING_RISK_CATEGORIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-[var(--muted)]">
          It measures how they address relevant conversation topics, avoid harmful advice, recognize
          crises, and steer youth toward safer outcomes.
        </p>
        <p className="text-[var(--muted)]">To conduct the assessment, we incorporated:</p>
        <ul className="list-disc space-y-3 pl-5 text-[var(--muted)]">
          <li>
            <span className="font-semibold text-[var(--text)]">
              <a
                href="https://docs.google.com/spreadsheets/d/1h30gyWQOpKcj-F_h94oHNGWhMuYKlLJfJjapqWz0mWE/edit?usp=sharing"
                className={linkClass}
              >
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
            <span className="font-semibold text-[var(--text)]">Benchmarking and scoring:</span> Each
            target model was assessed by a single reasoning judge model (GPT 5.4 Mini, GPT 5.5,
            Claude Sonnet 4.6 or Gemini 3.5 Flash due to their ability to break down nuanced and
            complex meanings), with the judge always different from the target being evaluated.
            Scores are computed based on KORA&apos;s rubric, and the corresponding metrics are
            shared on our leaderboard. We ran a total of 1380 scenarios across both assistant- and
            child-aware prompts among 18 frontier models.
          </li>
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--gray-100)] p-4">
        <h2 className="text-base font-semibold text-[var(--text)]">Coming soon</h2>
        <p className="text-[var(--muted)]">
          We are exploring ways to expand our evaluation methods to a trajectory-based benchmark. As
          we examine how young people engage with AI and how mental health and sexual risks can
          emerge, evolve, and accumulate over time, we see a significant gap in current evaluation
          approaches: the ability to assess risk signals longitudinally across repeated
          interactions rather than in isolated conversations. If you would like to help with this
          critical work, please reach out. Stay tuned for updates on our developments here!
        </p>
      </section>
    </div>
  );
}

function SexualSafetyMethodologyPanel() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-[var(--text)] md:text-base">
      <h2 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
        How the apgard Youth Sexual Safety Benchmark works
      </h2>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Overview</h2>
        <p className="text-[var(--muted)]">
          Young people are increasingly turning to AI platforms to learn more about sexual topics
          and their own sexuality, but few evaluations focus on youth sexual safety risks beyond
          child sexual exploitation and abuse (CSEA). While some benchmarks focus on child safety
          and CSEA as larger categories, few evaluate fine-grained youth sexual safety sub-risk
          categories, which misses risks that are more ambiguous if not examined directly. For
          example, measurements of how AI responds to a teen asking how to pose for sexy photos are
          underrepresented if safety categories are only focused on illegal CSEA risks. To address
          this gap, apgard is introducing the apgard Benchmark, going deeper on youth sexual safety
          risks and failure modes so builders and policymakers can make better evidence-based
          decisions to support young people and their distinct needs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">Methodology</h2>
        <p className="text-[var(--muted)]">
          Our benchmark evaluates models against auto-generated youth-AI scenarios driven by our
          expert-informed taxonomy of youth sexual safety risks across the following high-level risk
          categories, which includes Adult Sexual Content Exposure and CSEA:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
          {SEXUAL_SAFETY_RISK_CATEGORIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-[var(--muted)]">
          It measures how they address relevant conversation topics, avoid harmful advice, recognize
          crises, and steer youth toward safer outcomes.
        </p>
        <p className="text-[var(--muted)]">To conduct the assessment, we incorporated:</p>
        <ul className="list-disc space-y-3 pl-5 text-[var(--muted)]">
          <li>
            <span className="font-semibold text-[var(--text)]">Taxonomy design:</span> We
            synthesized existing research and literature into a youth- and AI-specific risk taxonomy
            for youth sexual safety.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Expert review:</span> 3 youth safety
            and sexual health experts reviewed, refined, and validated our approach for this youth
            sexual safety benchmark.
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
            to derive this youth sexual safety benchmark.
          </li>
          <li>
            <span className="font-semibold text-[var(--text)]">Benchmarking and scoring:</span> Each
            target model was assessed by a single reasoning judge model (GPT 5.4 Mini, GPT 5.5,
            Claude Sonnet 4.6 or Gemini 3.5 Flash due to their ability to break down nuanced and
            complex meanings), with the judge always different from the target being evaluated.
            Scores are computed based on KORA&apos;s rubric, and the corresponding metrics are
            shared on our leaderboard. We ran a total of 9,660 scenarios across both assistant- and
            child-aware prompts among 18 frontier models.
          </li>
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--gray-100)] p-4">
        <h2 className="text-base font-semibold text-[var(--text)]">Coming soon</h2>
        <p className="text-[var(--muted)]">
          We are exploring ways to expand our evaluation methods to a trajectory-based benchmark. As
          we examine how young people engage with AI and how mental health and sexual risks can
          emerge, evolve, and accumulate over time, we see a significant gap in current evaluation
          approaches: the ability to assess risk signals longitudinally across repeated
          interactions rather than in isolated conversations. If you would like to help with this
          critical work, please reach out. Stay tuned for updates on our developments here!
        </p>
      </section>
    </div>
  );
}

export function LeaderboardSidebar({
  benchmarkId = "wellbeing",
}: {
  benchmarkId?: BenchmarkId;
}) {
  const [tab, setTab] = useState<SidebarTab>("leaderboard");
  const isSexualSafety = benchmarkId === "csea";

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
        {tab === "leaderboard" ? (
          isSexualSafety ? (
            <SexualSafetyOverviewPanel />
          ) : (
            <WellbeingOverviewPanel />
          )
        ) : isSexualSafety ? (
          <SexualSafetyMethodologyPanel />
        ) : (
          <WellbeingMethodologyPanel />
        )}
      </div>
    </aside>
  );
}
