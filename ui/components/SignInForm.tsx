"use client";

import {
  createUserWithEmailAndPassword,
  getIdToken,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApgardLogo } from "components/ApgardLogo";
import { GoogleSignInButton } from "components/GoogleSignInButton";
import { EMAIL_FOR_SIGN_IN_STORAGE_KEY, getEmailLinkActionUrl } from "lib/email-link-auth";
import { getFirebaseAuth } from "lib/firebase-client";
import { postSessionLogin } from "lib/session-login-client";

async function completeSessionLogin(
  idToken: string,
  name: string | undefined,
  nextPath: string,
  router: ReturnType<typeof useRouter>,
  onAuthenticated?: () => void
) {
  const result = await postSessionLogin({
    token: idToken,
    ...(name ? { name } : {}),
  });
  if (!result.ok) {
    return result;
  }
  onAuthenticated?.();
  router.replace(nextPath);
  router.refresh();
  return { ok: true as const };
}

export type SignInFormProps = {
  /** When set, overrides the `?next=` search param. */
  nextPath?: string;
  /** Called after session cookie is created (before navigation). */
  onAuthenticated?: () => void;
};

export function SignInForm({ nextPath: nextPathProp, onAuthenticated }: SignInFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [emailAuthMode, setEmailAuthMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [completingEmailLink, setCompletingEmailLink] = useState(false);
  const [sessionRetryable, setSessionRetryable] = useState(false);
  const [retryingSession, setRetryingSession] = useState(false);
  const pendingSessionRef = useRef<{ idToken: string; name?: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextFromQuery = searchParams.get("next");
  const nextPath =
    nextPathProp ??
    (nextFromQuery?.startsWith("/") ? nextFromQuery : "/benchmark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get("oobCode");
    const guardKey = oobCode ? `firebaseEmailLink_${oobCode}` : null;
    if (guardKey && sessionStorage.getItem(guardKey)) return;
    if (guardKey) sessionStorage.setItem(guardKey, "1");

    let cancelled = false;
    void (async () => {
      setCompletingEmailLink(true);
      setError(null);
      try {
        let emailForLink = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY) ?? "";
        if (!emailForLink) {
          const prompted = window.prompt("Enter the email address you used to request the sign-in link.");
          emailForLink = prompted?.trim() ?? "";
        }
        if (!emailForLink) {
          throw new Error("Email is required to complete sign-in.");
        }
        const cred = await signInWithEmailLink(auth, emailForLink, window.location.href);
        if (cancelled) return;
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY);
        const idToken = await getIdToken(cred.user);
        const nameToSend = cred.user.displayName?.trim() || undefined;
        const sessionResult = await completeSessionLogin(
          idToken,
          nameToSend,
          nextPath,
          router,
          onAuthenticated
        );
        if (cancelled) return;
        if (sessionResult && !sessionResult.ok) {
          pendingSessionRef.current = { idToken, name: nameToSend };
          setSessionRetryable(sessionResult.retryable);
          setError(sessionResult.message);
          setCompletingEmailLink(false);
          return;
        }
        pendingSessionRef.current = null;
        setSessionRetryable(false);
      } catch (err) {
        console.error(err);
        if (guardKey) sessionStorage.removeItem(guardKey);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not complete email link sign-in.");
          setCompletingEmailLink(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nextPath, onAuthenticated, router]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      let cred;
      if (isLogin) {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      const idToken = await getIdToken(cred.user);
      const nameToSend =
        name.trim() || cred.user.displayName?.trim() || undefined;
      const sessionResult = await completeSessionLogin(
        idToken,
        nameToSend,
        nextPath,
        router,
        onAuthenticated
      );
      if (sessionResult && !sessionResult.ok) {
        pendingSessionRef.current = { idToken, name: nameToSend };
        setSessionRetryable(sessionResult.retryable);
        setError(sessionResult.message);
        setLoading(false);
        return;
      }
      pendingSessionRef.current = null;
      setSessionRetryable(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setLoading(false);
    }
  }

  async function retrySessionLogin() {
    const pending = pendingSessionRef.current;
    if (!pending) return;
    setError(null);
    setRetryingSession(true);
    try {
      const sessionResult = await completeSessionLogin(
        pending.idToken,
        pending.name,
        nextPath,
        router,
        onAuthenticated
      );
      if (sessionResult && !sessionResult.ok) {
        setSessionRetryable(sessionResult.retryable);
        setError(sessionResult.message);
        return;
      }
      pendingSessionRef.current = null;
      setSessionRetryable(false);
    } finally {
      setRetryingSession(false);
    }
  }

  async function handleSendEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    setLinkSent(false);
    try {
      const auth = getFirebaseAuth();
      const actionCodeSettings = {
        url: getEmailLinkActionUrl(nextPath),
        handleCodeInApp: true,
      };
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY, email.trim());
      await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
      setLinkSent(true);
    } catch (err) {
      console.error(err);
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_STORAGE_KEY);
      setError(err instanceof Error ? err.message : "Could not send sign-in link.");
    } finally {
      setLoading(false);
    }
  }

  const card = (
    <div className="apgard-card w-full max-w-md p-8">
      <div className="mb-6 flex justify-center">
        <ApgardLogo href="/" variant="full" width={100} height={56} />
      </div>
      <h2 className="mb-1 text-center text-xl font-semibold text-brand-dark">Sign in</h2>
      <p className="mb-4 text-center text-sm text-[var(--muted)]">
        Sign in to run the Youth Mental Wellbeing Benchmark.
      </p>

      <GoogleSignInButton
        nextPath={nextPath}
        onSessionFailure={(pending) => {
          pendingSessionRef.current = pending;
          setSessionRetryable(true);
        }}
        onSessionSuccess={() => {
          pendingSessionRef.current = null;
          setSessionRetryable(false);
          onAuthenticated?.();
        }}
      />

      {sessionRetryable && pendingSessionRef.current && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--gray-100)] p-3 text-center">
          <p className="text-xs text-[var(--muted)] mb-2">
            Firebase sign-in worked, but creating a session failed (often the API server is stopped).
          </p>
          <button
            type="button"
            onClick={() => void retrySessionLogin()}
            disabled={retryingSession}
            className="w-full rounded-lg border border-[var(--border)] py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)] disabled:opacity-50"
          >
            {retryingSession ? "Retrying…" : "Retry session"}
          </button>
        </div>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs text-[var(--muted)]">or email</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {isLogin && (
        <div className="flex rounded-lg border border-[var(--border)] p-0.5 mb-4">
          <button
            type="button"
            onClick={() => {
              setEmailAuthMode("password");
              setError(null);
              setLinkSent(false);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              emailAuthMode === "password"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--color-accent-nav)]"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailAuthMode("link");
              setError(null);
              setLinkSent(false);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              emailAuthMode === "link"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--color-accent-nav)]"
            }`}
          >
            Email link
          </button>
        </div>
      )}

      {isLogin && emailAuthMode === "link" ? (
        <form onSubmit={handleSendEmailLink} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              autoComplete="email"
            />
          </div>
          {linkSent && (
            <p className="text-sm text-[var(--muted)]">
              Check your inbox for a sign-in link. You can close this page.
            </p>
          )}
          {error && (
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send sign-in link"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Working…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setIsLogin(!isLogin);
          setError(null);
          setLinkSent(false);
          setEmailAuthMode("password");
        }}
        className="mt-4 w-full text-center text-sm text-[var(--accent)] hover:underline"
      >
        {isLogin ? "Need an account? Register" : "Have an account? Sign in"}
      </button>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link href="/" className="text-[var(--text)] hover:underline">
          ← Back to leaderboard
        </Link>
      </p>
    </div>
  );

  if (completingEmailLink) {
    const completingCard = (
      <div className="apgard-card w-full max-w-md space-y-4 p-8 text-center">
        <p className="text-[var(--text)]">Completing sign-in…</p>
        {error && (
          <>
            <p className="text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
            {sessionRetryable && pendingSessionRef.current && (
              <button
                type="button"
                onClick={() => void retrySessionLogin()}
                disabled={retryingSession}
                className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-200)] disabled:opacity-50"
              >
                {retryingSession ? "Retrying…" : "Try again"}
              </button>
            )}
          </>
        )}
      </div>
    );

    return (
      <div className="site-container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-6">
        {completingCard}
      </div>
    );
  }

  return (
    <div className="site-container flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-6">
      {card}
    </div>
  );
}
