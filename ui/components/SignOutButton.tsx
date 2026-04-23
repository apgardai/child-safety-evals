"use client";

import { useState } from "react";

import { apiUrl } from "lib/api-url";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
      window.location.assign("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy}
      className="rounded-lg border border-[var(--border)] bg-black/35 px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-white hover:bg-[var(--border)] disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
