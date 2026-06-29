import type { Metadata } from "next";

const linkClass = "font-semibold text-[var(--accent)] hover:underline";

export const metadata: Metadata = {
  title: "Privacy Policy — apgard Benchmark",
  description: "Privacy policy for the apgard Benchmark at benchmark.apgardai.com",
};

export default function PrivacyPage() {
  return (
    <div className="page-container flex min-h-[calc(100vh-4rem)] flex-col items-center py-12">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-brand-dark md:text-4xl">
            apgard Benchmark Privacy Policy
          </h1>
          <p className="text-sm text-[var(--muted)]">Last updated: June 2026</p>
        </div>

        <div className="space-y-6 text-base leading-relaxed text-[var(--muted)] md:text-lg">
          <p>
            This policy covers the apgard Benchmark at{" "}
            <a href="https://benchmark.apgardai.com" className={linkClass}>
              benchmark.apgardai.com
            </a>
            .
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">What we collect</h2>
            <p>When you create an account or use the benchmark, we may collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Name and email address</li>
              <li>Usage data (pages visited, benchmark runs, leaderboard interactions)</li>
            </ul>
            <p>We do not collect payment information or sensitive personal data.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">How we use it</h2>
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Send account-related communications (e.g. password resets)</li>
              <li>Contact you about major benchmark updates and new releases</li>
              <li>Request feedback for research purposes</li>
              <li>Understand how the benchmark is being used across different sectors</li>
            </ul>
            <p>We do not sell or share your data.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">Data retention</h2>
            <p>
              We retain your account data for as long as your account is active. You can request
              deletion at any time by emailing{" "}
              <a href="mailto:benchmark@apgardai.com" className={linkClass}>
                benchmark@apgardai.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">Cookies</h2>
            <p>
              We use essential cookies to operate the site and may use analytics cookies to
              understand usage patterns. You can disable cookies in your browser settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">
              Changes to this policy
            </h2>
            <p>
              We may update this policy from time to time. We&apos;ll notify registered users of
              material changes by email.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">Contact</h2>
            <p>
              Questions? Email us at{" "}
              <a href="mailto:benchmark@apgardai.com" className={linkClass}>
                benchmark@apgardai.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
