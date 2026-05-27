"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import requestsClient from "lib/requests-client";
import {
  clearStoredEvaluationRunId,
  readStoredEvaluationRunId,
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

const TERMINAL: EvaluationRunStatus[] = ["completed", "failed", "cancelled"];
const POLL_MS = 2500;

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

export type StartEvaluationPayload = {
  apiKey: string;
  customApiKey?: string;
  customApiEndpoint?: string;
  customParsingKey?: string;
  targetModel: string;
  judgeModel?: string;
  userModel?: string;
  prompts?: string[];
};

export function useActiveEvaluationRun(options?: {
  onCompleted?: (runId: string) => void;
}) {
  const [run, setRun] = useState<EvaluationRunSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onCompletedRef = useRef(options?.onCompleted);
  onCompletedRef.current = options?.onCompleted;

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

  const refreshRun = useCallback(
    async (runId: string) => {
      try {
        const snapshot = await fetchRun(runId, abortRef.current?.signal);
        setRun(snapshot);
        setPollError(null);
        writeStoredEvaluationRunId(runId);
        return snapshot;
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setPollError((e as Error).message);
        }
        return null;
      }
    },
    [fetchRun]
  );

  const resolveInitialRun = useCallback(async () => {
    setLoading(true);
    setPollError(null);
    try {
      const storedId = readStoredEvaluationRunId();
      if (storedId) {
        const snapshot = await fetchRun(storedId);
        setRun(snapshot);
        return;
      }

      const activeRes = await requestsClient.get<{
        active?: boolean;
        id?: string;
        status?: string;
        progress_log?: string;
        error_message?: string;
        target_model?: string;
        judge_model?: string;
        user_model?: string;
        created_at?: string;
        celery_task_id?: string;
        prompts?: string[];
      }>("/api/evaluation-runs/active", { validateStatus: () => true });

      if (
        activeRes.status >= 200 &&
        activeRes.status < 300 &&
        activeRes.data?.active &&
        activeRes.data.id
      ) {
        const snapshot = mapDetail(
          activeRes.data as Record<string, unknown>
        );
        setRun(snapshot);
        writeStoredEvaluationRunId(snapshot.id);
      } else {
        setRun(null);
      }
    } catch (e) {
      setPollError((e as Error).message);
      const storedId = readStoredEvaluationRunId();
      if (storedId) {
        setRun({
          id: storedId,
          status: "pending",
          progress_log: "Reconnecting to evaluation status…\n",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchRun]);

  useEffect(() => {
    void resolveInitialRun();
  }, [resolveInitialRun]);

  useEffect(() => {
    if (!run || TERMINAL.includes(run.status)) {
      return undefined;
    }

    const tick = () => {
      void refreshRun(run.id);
    };
    const interval = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(interval);
  }, [run?.id, run?.status, refreshRun]);

  useEffect(() => {
    if (run?.status === "completed" && run.id) {
      onCompletedRef.current?.(run.id);
    }
  }, [run?.status, run?.id]);

  const startEvaluation = useCallback(
    async (payload: StartEvaluationPayload) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setStarting(true);
      setPollError(null);
      clearStoredEvaluationRunId();
      setRun(null);

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
            judge_model: payload.judgeModel ?? "gpt-5.2:high:limited",
            user_model: payload.userModel ?? "deepseek-v3.2",
            input: "data/scenarios.jsonl",
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
        writeStoredEvaluationRunId(runId);
        const snapshot = await fetchRun(runId, signal);
        setRun(snapshot);
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
      const snapshot = mapDetail(res.data ?? {});
      setRun(snapshot);
      writeStoredEvaluationRunId(snapshot.id);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setPollError((e as Error).message);
      }
    } finally {
      setCancelling(false);
    }
  }, [run?.id]);

  const isInFlight =
    starting ||
    cancelling ||
    (run != null && !TERMINAL.includes(run.status));

  const canCancel =
    !starting &&
    !cancelling &&
    run != null &&
    (run.status === "pending" || run.status === "running");

  return {
    run,
    loading,
    starting,
    cancelling,
    isInFlight,
    canCancel,
    pollError,
    startEvaluation,
    cancelEvaluation: canCancel ? cancelEvaluation : undefined,
    refreshRun: run ? () => refreshRun(run.id) : undefined,
  };
}
