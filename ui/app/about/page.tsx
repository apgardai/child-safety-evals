import Link from "next/link";

const linkClass = "font-semibold text-[var(--accent)] hover:underline";

export default function AboutPage() {
  return (
    <div className="page-container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-12">
      <div className="w-full max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-brand-dark md:text-4xl">
          About the apgard Benchmark
        </h1>
        <div className="space-y-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
          <p>
            The apgard Benchmark is an open-source effort to strengthen child-centered technology
            that prevents online child sexual exploitation and abuse (CSEA) and supports youth
            well-being, aligned with the goals of the{" "}
            <a
              href="https://safeonline.global/meet-the-new-safe-online-grantees-2025/"
              className={linkClass}
              target="_blank"
              rel="noopener noreferrer"
            >
              Safe Online
            </a>{" "}
            fund. It was developed by{" "}
            <a
              href="https://www.apgardai.com/"
              className={linkClass}
              target="_blank"
              rel="noopener noreferrer"
            >
              apgard ai
            </a>
            , with support from a team of 24 youth mental health, online safety, and AI experts.
          </p>
          <p>
            The benchmark is designed for any team deploying AI for young people, including
            education, communication, and wellness apps.
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <span className="font-semibold text-[var(--text)]">For parents and schools:</span> Ask
              technology partners to share apgard Benchmark scores to ensure youth mental well-being
              standards are met.
            </li>
            <li>
              <span className="font-semibold text-[var(--text)]">For developers:</span> Integrate
              the apgard Benchmark into your evaluation pipelines to identify youth mental
              well-being risks pre and post-deployment.
            </li>
            <li>
              <span className="font-semibold text-[var(--text)]">For policymakers:</span> Use apgard
              Benchmark as an input to standards, procurement criteria, and policy development.
            </li>
          </ul>
          <p>
            We are excited to contribute to the broader youth AI safety ecosystem alongside:
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <a
                href="https://korabench.ai/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                KORA
              </a>
              , AI child safety benchmark
            </li>
            <li>
              <a
                href="https://dl.acm.org/doi/10.1145/3719027.3765168"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouthSafe
              </a>{" "}
              benchmark and risk detection model
            </li>
            <li>
              <a
                href="https://institute.commonsensemedia.org/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Common Sense Media&apos;s Youth AI Safety Institute
              </a>
            </li>
            <li>
              <a
                href="https://www.trackyouthmentalhealth.com/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Surgo Health&apos;s youth mental health research
              </a>
            </li>
            <li>
              <a
                href="https://everyone.ai/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                everyone.ai&apos;s
              </a>{" "}
              <a
                href="https://everyone.ai/research/relational-positioning-dependency-exclusivity-policy-rpd/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Relational Positioning, Dependency, and Exclusivity model Policy
              </a>
            </li>
            <li>
              <a
                href="https://www.vyanams.com/"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Vys&apos;
              </a>{" "}
              youth safety advisory services
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/" className="apgard-btn-secondary">
            View leaderboard
          </Link>
          <Link href="/benchmark" className="apgard-btn-primary">
            Run evaluations
          </Link>
        </div>
      </div>
    </div>
  );
}
