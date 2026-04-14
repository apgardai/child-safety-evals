"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { requiresAuthPathname } from "@/lib/auth-paths";

const baseTabs = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/test-results", label: "Test results" },
] as const;

const benchmarkTab = { href: "/benchmark", label: "Run Evaluations" } as const;

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
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { user?: { email?: string } };
        setUserEmail(data.user?.email ?? null);
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still clear UI */
    }
    setUserEmail(null);
    router.refresh();
    if (requiresAuthPathname(pathname)) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  const loginHref =
    pathname && pathname !== "/login"
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";

  const navTabs = userEmail
    ? [
        baseTabs[0],
        ...baseTabs.slice(1),
        benchmarkTab,
      ]
    : [...baseTabs];

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

        <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3 min-w-0">
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
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--border)]/40 md:text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href={loginHref}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
