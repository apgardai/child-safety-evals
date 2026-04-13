"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/test-results", label: "Test results" },
] as const;

function tabClassName(active: boolean) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--border)] text-white"
      : "text-[var(--muted)] hover:bg-[var(--border)]/60 hover:text-white",
  ].join(" ");
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-6 md:px-6">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold text-white md:text-base tracking-tight hover:text-[var(--accent)]"
        >
          Child Safety Evals
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto sm:gap-2"
          aria-label="Primary"
        >
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link key={tab.href} href={tab.href} className={tabClassName(active)}>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/login?next=/benchmark"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
