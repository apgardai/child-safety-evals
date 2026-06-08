import type { ReactNode } from "react";
import {
  displayModelLabel,
  resolveLeaderboardRowForTarget,
} from "lib/resolveLeaderboardProfile";
import type { ViewerData } from "lib/viewerDataFromZip";

const MISSING_MODEL_FIELD = "—";

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
      <dd className="mt-1 text-sm leading-snug text-[var(--text)]">{value}</dd>
    </div>
  );
}

export function TestResultsModelOverview({ data }: { data: ViewerData }) {
  const target = data.summary?.target?.trim() ?? "";
  const judge = data.summary?.judge?.trim() ?? "";
  const user = data.summary?.user?.trim() ?? "";
  const profile = resolveLeaderboardRowForTarget(target);

  const title = displayModelLabel(target);
  const subtitle = profile?.provider ?? (target ? "Benchmark target" : "");

  return (
    <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] mb-2">
        Test results
      </p>
      <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight md:text-3xl">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      ) : null}

      <div className="mt-6 border-t border-[var(--border)] pt-6 space-y-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Fact label="Provider" value={profile?.provider ?? MISSING_MODEL_FIELD} />
          <Fact label="Size" value={profile?.size ?? MISSING_MODEL_FIELD} />
          <Fact label="License" value={profile?.license ?? MISSING_MODEL_FIELD} />
          <Fact label="Reference dates" value={profile?.date ?? MISSING_MODEL_FIELD} />
          <Fact label="Judge model" value={judge || MISSING_MODEL_FIELD} />
          <Fact label="User model" value={user || MISSING_MODEL_FIELD} />
        </dl>
      </div>
    </header>
  );
}
