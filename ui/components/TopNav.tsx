"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ApgardLogo } from "components/ApgardLogo";
import { useSession } from "hooks/useSession";
import { requiresAuthPathname } from "lib/auth-paths";
import { clearAllStoredEvaluationRunIds } from "lib/active-evaluation-run-storage";
import requestsClient from "lib/requests-client";
import { notifySessionUpdated } from "lib/session-events";

const baseTabs = [
  { href: "/about", label: "About" },
  { href: "/mental-wellbeing", label: "Leaderboard" },
] as const;

const benchmarkTab = { href: "/benchmark", label: "Run Evaluations" } as const;

function tabClassName(active: boolean) {
  return [
    "border-b-[3px] px-2 py-2 text-sm font-semibold capitalize transition-colors md:px-3 md:text-base",
    active
      ? "border-[var(--color-accent-nav)] text-[var(--color-accent-nav)]"
      : "border-transparent text-brand-dark hover:border-[var(--color-accent-nav)] hover:text-[var(--color-accent-nav)]",
  ].join(" ");
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const onBenchmark = pathname === "/benchmark";
  const { userEmail, authReady } = useSession({ enabled: !onBenchmark });

  async function handleSignOut() {
    try {
      await requestsClient.post("/api/auth/logout", null, { validateStatus: () => true });
    } catch {
      /* still clear UI */
    }
    clearAllStoredEvaluationRunIds();
    notifySessionUpdated();
    router.refresh();
    if (requiresAuthPathname(pathname)) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }

  const loginHref =
    pathname && pathname !== "/sign-in"
      ? `/sign-in?next=${encodeURIComponent(pathname)}`
      : "/sign-in";

  const navTabs = [...baseTabs, benchmarkTab];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="site-container flex items-center gap-3 py-3 md:gap-6">
        <ApgardLogo href="/" width={50} height={28} title="apgard Benchmark" />

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto sm:gap-4"
          aria-label="Primary"
        >
          {navTabs.map((tab) => {
            const active =
              tab.href === "/mental-wellbeing"
                ? pathname === "/mental-wellbeing" ||
                  pathname === "/sexual-safety" ||
                  pathname.startsWith("/leaderboard/")
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link key={tab.href} href={tab.href} className={tabClassName(active)}>
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 md:gap-3">
          {!authReady ? (
            <span className="text-xs text-[var(--muted)] md:text-sm" aria-hidden>
              …
            </span>
          ) : userEmail ? (
            <>
              <span
                className="min-w-0 max-w-[min(42vw,14rem)] truncate text-right text-xs text-[var(--muted)] md:max-w-[240px] md:text-sm"
                title={userEmail}
              >
                {userEmail}
              </span>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="apgard-btn-secondary px-3 py-2 text-xs md:text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href={loginHref} className="apgard-btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
