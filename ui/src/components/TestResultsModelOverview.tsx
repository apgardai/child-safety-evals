import type { ReactNode } from "react";
import { humanizeSlug } from "@/lib/humanizeSlug";
import { resolveLeaderboardRowForTarget } from "@/lib/resolveLeaderboardProfile";
import type { ViewerData } from "@/lib/viewerDataFromZip";

function Fact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm leading-snug text-white/95">{value}</dd>
    </div>
  );
}

export function TestResultsModelOverview({ data }: { data: ViewerData }) {
  const target = data.summary?.target?.trim() ?? "";
  const profile = resolveLeaderboardRowForTarget(target);

  const slugHead = target.split(/[:]/)[0]?.trim() ?? target;
  const title = profile?.model ?? (slugHead ? humanizeSlug(slugHead) : "Unknown target");
  const subtitle = profile?.provider ?? (target ? "Benchmark target" : "");

  const allLinks = profile
    ? [...profile.apiLinks, ...(profile.inferenceLinks ?? [])]
    : [];

  return (
    <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 mb-8">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] mb-2">
        Test results
      </p>
      <h1 className="text-2xl font-bold text-white tracking-tight md:text-3xl">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      ) : null}

      {profile ? (
        <div className="mt-6 border-t border-[var(--border)] pt-6 space-y-5">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Provider" value={profile.provider} />
            <Fact label="Size" value={profile.size} />
            <Fact label="License" value={profile.license} />
            <Fact label="Reference dates" value={profile.date} />
          </dl>
          {profile.notes ? (
            <p className="text-sm text-[var(--muted)] leading-relaxed border-l-2 border-[var(--accent)]/50 pl-3">
              {profile.notes}
            </p>
          ) : null}
          {allLinks.length > 0 ? (
            <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2 text-sm">
              {allLinks.map((l) => (
                <li key={l.href} className="min-w-0">
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline break-words"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)] leading-relaxed">
          No curated model card matches this registry slug. Evaluation metrics below still reflect
          this run&apos;s <code className="text-white/80">target</code> entry.
        </p>
      )}
    </header>
  );
}
