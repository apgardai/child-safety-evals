"use client";

import { GoogleAuthProvider, getIdToken, signInWithPopup } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { getFirebaseAuth } from "@/lib/firebase-client";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/benchmark";

  async function signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await getIdToken(user);
      const nameToSend = user.displayName?.trim() || undefined;
      const res = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: idToken,
          ...(nameToSend ? { name: nameToSend } : {}),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Sign-in failed (${res.status})`);
      }
      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      {error && (
        <p className="text-sm text-[var(--error)] text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
