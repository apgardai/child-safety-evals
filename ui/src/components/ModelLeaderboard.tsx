import type { DocLink, LeaderboardRow } from "@/data/leaderboardModels";
import {
  mainLeaderboardModels,
  otherLeaderboardModels,
} from "@/data/leaderboardModels";

function LinkList({ title, links }: { title: string; links: DocLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="text-sm">
      <span className="text-[var(--muted)]">{title}: </span>
      <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            {l.label}
          </a>
        ))}
      </span>
    </div>
  );
}

function ModelCard({ row }: { row: LeaderboardRow }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">{row.provider}</h3>
          <p className="text-white/90 mt-0.5">{row.model}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-[var(--border)] bg-black/25 px-3 py-1.5 text-center text-sm font-medium text-[var(--warning)]">
          Overall results: Coming soon
        </div>
      </div>
      <dl className="grid gap-1 text-sm text-[var(--muted)] sm:grid-cols-3">
        <div>
          <dt className="sr-only">Date</dt>
          <dd>
            <span className="text-[var(--muted)]">Date: </span>
            {row.date}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Size</dt>
          <dd>
            <span className="text-[var(--muted)]">Size: </span>
            {row.size}
          </dd>
        </div>
        <div>
          <dt className="sr-only">License</dt>
          <dd>
            <span className="text-[var(--muted)]">License: </span>
            {row.license}
          </dd>
        </div>
      </dl>
      <div className="space-y-1.5 border-t border-[var(--border)] pt-3">
        <LinkList title="API" links={row.apiLinks} />
        {row.inferenceLinks && row.inferenceLinks.length > 0 ? (
          <LinkList title="Inference" links={row.inferenceLinks} />
        ) : null}
        {row.notes ? (
          <p className="text-sm text-[var(--muted)]">
            <span className="text-white/70">Note: </span>
            {row.notes}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ModelLeaderboard() {
  return (
    <section className="w-full max-w-4xl space-y-6" aria-labelledby="leaderboard-heading">
      <div className="text-center space-y-2">
        <h2 id="leaderboard-heading" className="text-xl font-semibold text-white md:text-2xl">
          Model leaderboard
        </h2>
        <p className="text-2xl font-bold tracking-tight text-[var(--warning)] md:text-3xl">
          Coming soon
        </p>
        <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">
          Overall child-safety benchmark scores across models will be published here. Below is the
          model lineup and reference documentation.
        </p>
      </div>
      <div className="space-y-3">
        {mainLeaderboardModels.map((row) => (
          <ModelCard key={`${row.provider}-${row.model}`} row={row} />
        ))}
      </div>
      <h3 className="text-lg font-semibold text-white pt-2">Other</h3>
      <div className="space-y-3">
        {otherLeaderboardModels.map((row) => (
          <ModelCard key={`${row.provider}-${row.model}`} row={row} />
        ))}
      </div>
    </section>
  );
}
