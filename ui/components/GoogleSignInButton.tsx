"use client";

import { GoogleAuthProvider, getIdToken, signInWithPopup } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { getFirebaseAuth } from "lib/firebase-client";
import { postSessionLogin } from "lib/session-login-client";

type Props = {
  /** When set, overrides the `?next=` search param. */
  nextPath?: string;
  /** Called when Firebase succeeded but `/api/auth/session-login` failed; use stored token to retry. */
  onSessionFailure?: (pending: { idToken: string; name?: string }) => void;
  onSessionSuccess?: () => void;
};

export function GoogleSignInButton({ nextPath: nextPathProp, onSessionFailure, onSessionSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextFromQuery = searchParams.get("next");
  const nextPath =
    nextPathProp ??
    (nextFromQuery?.startsWith("/") ? nextFromQuery : "/benchmark");

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
      const sessionResult = await postSessionLogin({
        token: idToken,
        ...(nameToSend ? { name: nameToSend } : {}),
      });
      if (!sessionResult.ok) {
        onSessionFailure?.({ idToken, name: nameToSend });
        setError(sessionResult.message);
        setLoading(false);
        return;
      }
      onSessionSuccess?.();
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
