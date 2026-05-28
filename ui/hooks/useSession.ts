"use client";

import { useCallback, useEffect, useState } from "react";

import { SESSION_UPDATED_EVENT } from "lib/session-events";
import requestsClient from "lib/requests-client";

type UseSessionOptions = {
  /** When false, skips fetching and marks auth as ready with no user. */
  enabled?: boolean;
};

export function useSession(options?: UseSessionOptions) {
  const enabled = options?.enabled ?? true;
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
    if (!enabled) {
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    void loadSession();
  }, [enabled, loadSession]);

  useEffect(() => {
    const onSessionUpdated = () => {
      void loadSession();
    };
    window.addEventListener(SESSION_UPDATED_EVENT, onSessionUpdated);
    return () => window.removeEventListener(SESSION_UPDATED_EVENT, onSessionUpdated);
  }, [loadSession]);

  return { userEmail, authReady, loadSession, isSignedIn: Boolean(userEmail) };
}
