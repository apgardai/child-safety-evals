import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="site-container flex flex-col items-center justify-between gap-2 py-6 text-sm text-[var(--muted)] sm:flex-row">
        <span>© {new Date().getFullYear()} apgard ai. All rights reserved.</span>
        <Link
          href="/privacy"
          className="font-semibold text-brand-dark hover:text-[var(--color-accent-nav)]"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
