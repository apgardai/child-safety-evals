"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApgardLogo } from "components/ApgardLogo";
import { requiresAuthPathname } from "lib/auth-paths";
import { clearAllStoredEvaluationRunIds } from "lib/active-evaluation-run-storage";
import requestsClient from "lib/requests-client";

const baseTabs = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await requestsClient.get<{ user?: { email?: string } }>("/api/auth/me", {
        validateStatus: () => true,
      });
      if (res.status === 200) {
        setUserEmail(res.data.user?.email ?? null);
      } else {
        setUserEmail(null);
      }
    } catch {
      setUserEmail(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession, pathname]);

  async function handleSignOut() {
    try {
      await requestsClient.post("/api/auth/logout", null, { validateStatus: () => true });
    } catch {
      /* still clear UI */
    }
    clearAllStoredEvaluationRunIds();
    setUserEmail(null);
    router.refresh();
    if (requiresAuthPathname(pathname)) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }

  const loginHref =
    pathname && pathname !== "/sign-in"
      ? `/sign-in?next=${encodeURIComponent(pathname)}`
      : "/sign-in";

  const navTabs = userEmail
    ? [
        baseTabs[0],
        ...baseTabs.slice(1),
        benchmarkTab,
      ]
    : [...baseTabs];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="site-container flex items-center gap-3 py-3 md:gap-6">
        <ApgardLogo href="/" width={50} height={28} title="YouthSafe AI Benchmark" />

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto sm:gap-4"
          aria-label="Primary"
        >
          {navTabs.map((tab) => {
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
