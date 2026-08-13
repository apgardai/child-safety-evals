"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import requestsClient from "lib/requests-client";
import {
  clearLegacyStoredEvaluationRunId,
  clearStoredEvaluationRunId,
  writeStoredEvaluationRunId,
} from "lib/active-evaluation-run-storage";

import {
  normalizeEvaluationRunStatus,
  type EvaluationRunStatus,
} from "lib/evaluationRunStatus";

export type { EvaluationRunStatus };

export type EvaluationRunSnapshot = {
  id: string;
  status: EvaluationRunStatus;
  created_at?: string;
  target_model?: string | null;
  judge_model?: string | null;
  user_model?: string | null;
  prompts?: string[] | null;
  error_message?: string | null;
  progress_log?: string | null;
  celery_task_id?: string | null;
  scenarios_completed?: number | null;
  scenarios_total?: number | null;
};

type BenchmarkContextResponse = {
  in_flight?: Record<string, unknown> | null;
  resumable?: Record<string, unknown> | null;
};

const IN_FLIGHT: EvaluationRunStatus[] = ["pending", "running"];
const POLL_MS = 2500;

const DISMISSED_RESUMABLE_PREFIX = "cse_dismissed_resumable:";

function mapDetail(data: Record<string, unknown>): EvaluationRunSnapshot {
  return {
    id: String(data.id ?? ""),
    status: normalizeEvaluationRunStatus(
      typeof data.status === "string" ? data.status : undefined
    ),
    created_at:
      typeof data.created_at === "string" ? data.created_at : undefined,
    target_model:
      typeof data.target_model === "string" ? data.target_model : null,
    judge_model:
      typeof data.judge_model === "string" ? data.judge_model : null,
    user_model:
      typeof data.user_model === "string" ? data.user_model : null,
    prompts: Array.isArray(data.prompts)
      ? data.prompts.filter((p): p is string => typeof p === "string")
      : null,
    error_message:
      typeof data.error_message === "string" ? data.error_message : null,
    progress_log:
      typeof data.progress_log === "string" ? data.progress_log : null,
    celery_task_id:
      typeof data.celery_task_id === "string" ? data.celery_task_id : null,
    scenarios_completed:
      typeof data.scenarios_completed === "number"
        ? data.scenarios_completed
        : null,
    scenarios_total:
      typeof data.scenarios_total === "number" ? data.scenarios_total : null,
  };
}

function isInFlightStatus(status: EvaluationRunStatus): boolean {
  return IN_FLIGHT.includes(status);
}

function dismissedResumableKey(accountId: string): string {
  return `${DISMISSED_RESUMABLE_PREFIX}${accountId}`;
}

function isResumableDismissed(accountId: string, runId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(dismissedResumableKey(accountId)) === runId
    );
  } catch {
    return false;
  }
}

function dismissResumableRun(accountId: string, runId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(dismissedResumableKey(accountId), runId);
  } catch {
    /* ignore */
  }
}

async function fetchAccountId(signal?: AbortSignal): Promise<string | null> {
  const res = await requestsClient.get<{
    user?: { account_id?: string };
  }>("/api/auth/me", { signal, validateStatus: () => true });
  if (res.status < 200 || res.status >= 300) return null;
  const id = res.data.user?.account_id?.trim();
  return id || null;
}

export type StartEvaluationPayload = {
  apiKey: string;
  customApiKey?: string;
  customApiEndpoint?: string;
  customParsingKey?: string;
  targetModel: string;
  judgeModel?: string;
  userModel?: string;
  prompts?: string[];
  /** wellbeing | csea — server maps to the scenarios file */
  benchmark?: string;
};

export function useActiveEvaluationRun(options?: {
  onCompleted?: (runId: string) => void;
}) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [run, setRun] = useState<EvaluationRunSnapshot | null>(null);
  const [resumableRun, setResumableRun] = useState<EvaluationRunSnapshot | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const accountIdRef = useRef<string | null>(null);
  const onCompletedRef = useRef(options?.onCompleted);
  onCompletedRef.current = options?.onCompleted;

  accountIdRef.current = accountId;

  const applyBenchmarkContext = useCallback(
    (data: BenchmarkContextResponse, acctId: string) => {
      const inFlight = data.in_flight
        ? mapDetail(data.in_flight)
        : null;
      const resumable = data.resumable
        ? mapDetail(data.resumable)
        : null;

      if (inFlight && isInFlightStatus(inFlight.status)) {
        setRun(inFlight);
        setResumableRun(null);
        writeStoredEvaluationRunId(acctId, inFlight.id);
        return;
      }

      setRun(null);
      clearStoredEvaluationRunId(acctId);

      if (
        resumable &&
        resumable.status === "cancelled" &&
        !isResumableDismissed(acctId, resumable.id)
      ) {
        setResumableRun(resumable);
      } else {
        setResumableRun(null);
      }
    },
    []
  );

  const fetchBenchmarkContext = useCallback(
    async (signal?: AbortSignal) => {
      const res = await requestsClient.get<BenchmarkContextResponse>(
        "/api/evaluation-runs/benchmark-context",
        { signal, validateStatus: () => true }
      );
      if (res.status < 200 || res.status >= 300) {
        throw new Error(
          `Could not load evaluation context (HTTP ${res.status})`
        );
      }
      return res.data ?? {};
    },
    []
  );

  const fetchRun = useCallback(async (runId: string, signal?: AbortSignal) => {
    const res = await requestsClient.get<Record<string, unknown>>(
      `/api/evaluation-runs/${encodeURIComponent(runId)}`,
      { signal, validateStatus: () => true }
    );
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Could not load run status (HTTP ${res.status})`);
    }
    return mapDetail(res.data ?? {});
  }, []);

  const handleTerminalSnapshot = useCallback(
    async (snapshot: EvaluationRunSnapshot, acctId: string) => {
      if (snapshot.status === "completed" && snapshot.id) {
        onCompletedRef.current?.(snapshot.id);
      }
      clearStoredEvaluationRunId(acctId);
      setRun(null);

      try {
        const context = await fetchBenchmarkContext(abortRef.current?.signal);
        applyBenchmarkContext(context, acctId);
      } catch {
        setResumableRun(null);
      }
    },
    [applyBenchmarkContext, fetchBenchmarkContext]
  );

  const refreshRun = useCallback(
    async (runId: string) => {
      const acctId = accountIdRef.current;
      try {
        const snapshot = await fetchRun(runId, abortRef.current?.signal);
        if (!isInFlightStatus(snapshot.status)) {
          if (acctId) {
            await handleTerminalSnapshot(snapshot, acctId);
          } else {
            setRun(null);
          }
          return snapshot;
        }
        setRun(snapshot);
        setResumableRun(null);
        setPollError(null);
        if (acctId) {
          writeStoredEvaluationRunId(acctId, runId);
        }
        return snapshot;
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setPollError((e as Error).message);
        }
        return null;
      }
    },
    [fetchRun, handleTerminalSnapshot]
  );

  const resolveInitialRun = useCallback(async () => {
    setLoading(true);
    setPollError(null);
    try {
      const acctId = await fetchAccountId(abortRef.current?.signal);
      setAccountId(acctId);
      clearLegacyStoredEvaluationRunId();
      if (!acctId) {
        setRun(null);
        setResumableRun(null);
        return;
      }

      const context = await fetchBenchmarkContext(abortRef.current?.signal);
      applyBenchmarkContext(context, acctId);
    } catch (e) {
      setPollError((e as Error).message);
      setRun(null);
      setResumableRun(null);
    } finally {
      setLoading(false);
    }
  }, [applyBenchmarkContext, fetchBenchmarkContext, fetchRun]);

  useEffect(() => {
    void resolveInitialRun();
  }, [resolveInitialRun]);

  useEffect(() => {
    if (!run || !isInFlightStatus(run.status)) {
      return undefined;
    }

    const tick = () => {
      void refreshRun(run.id);
    };
    const interval = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(interval);
  }, [run?.id, run?.status, refreshRun]);

  const startEvaluation = useCallback(
    async (payload: StartEvaluationPayload) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setStarting(true);
      setPollError(null);
      const acctId = accountIdRef.current ?? (await fetchAccountId(signal));
      if (acctId) {
        setAccountId(acctId);
        clearStoredEvaluationRunId(acctId);
      }
      setRun(null);
      setResumableRun(null);

      try {
        if (payload.apiKey.trim()) {
          await requestsClient.put(
            "/api/account/ai-gateway-key",
            { apiKey: payload.apiKey.trim() },
            { signal }
          );
        }

        const startRes = await requestsClient.post<{
          id: string;
          status: string;
          celery_task_id?: string;
        }>(
          "/api/evaluation-runs/start",
          {
            target_model: payload.targetModel,
            judge_model: payload.judgeModel ?? "gpt-5.2:medium:limited",
            user_model: payload.userModel ?? "deepseek-v3.2",
            benchmark: payload.benchmark ?? "wellbeing",
            prompts: payload.prompts,
            custom_api_key: payload.customApiKey,
            custom_api_endpoint: payload.customApiEndpoint,
            custom_parsing_key: payload.customParsingKey,
          },
          { signal, validateStatus: () => true }
        );

        if (startRes.status < 200 || startRes.status >= 300) {
          const detail =
            (startRes.data as { detail?: string })?.detail ??
            startRes.statusText;
          throw new Error(detail || `HTTP ${startRes.status}`);
        }

        const runId = startRes.data.id;
        if (acctId) {
          writeStoredEvaluationRunId(acctId, runId);
        }
        const snapshot = await fetchRun(runId, signal);
        if (isInFlightStatus(snapshot.status)) {
          setRun(snapshot);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setPollError((e as Error).message);
        }
      } finally {
        setStarting(false);
        abortRef.current = null;
      }
    },
    [fetchRun]
  );

  const cancelEvaluation = useCallback(async () => {
    if (!run?.id) return;
    setCancelling(true);
    setPollError(null);
    try {
      const res = await requestsClient.post<Record<string, unknown>>(
        `/api/evaluation-runs/${encodeURIComponent(run.id)}/cancel`,
        {},
        { validateStatus: () => true }
      );
      if (res.status < 200 || res.status >= 300) {
        const detail =
          (res.data as { detail?: string })?.detail ?? res.statusText;
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const acctId = accountIdRef.current;
      setRun(null);
      if (acctId) {
        clearStoredEvaluationRunId(acctId);
        const context = await fetchBenchmarkContext();
        applyBenchmarkContext(context, acctId);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setPollError((e as Error).message);
      }
    } finally {
      setCancelling(false);
    }
  }, [applyBenchmarkContext, fetchBenchmarkContext, run?.id]);

  const dismissResumable = useCallback(() => {
    if (!resumableRun?.id || !accountId) return;
    dismissResumableRun(accountId, resumableRun.id);
    setResumableRun(null);
  }, [accountId, resumableRun?.id]);

  const isInFlight =
    starting ||
    cancelling ||
    (run != null && isInFlightStatus(run.status));

  const canCancel =
    !starting &&
    !cancelling &&
    run != null &&
    (run.status === "pending" || run.status === "running");

  return {
    run,
    resumableRun,
    loading,
    starting,
    cancelling,
    isInFlight,
    canCancel,
    pollError,
    startEvaluation,
    cancelEvaluation: canCancel ? cancelEvaluation : undefined,
    dismissResumable: resumableRun ? dismissResumable : undefined,
    refreshRun: run ? () => refreshRun(run.id) : undefined,
  };
}
