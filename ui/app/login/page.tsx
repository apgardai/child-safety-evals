"use client";

import { Suspense } from "react";

import { SignInForm } from "components/SignInForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
