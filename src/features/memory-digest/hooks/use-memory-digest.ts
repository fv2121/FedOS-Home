"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DigestGenerationOptions,
  DigestLLMResult,
  DigestStatus,
} from "../model/memory-digest-types";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
};

async function apiCall<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
  });
  const body: ApiEnvelope<T> = await res.json().catch(() => ({ ok: false }));
  if (!res.ok || !body.ok) {
    const msg = body.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body.data as T;
}

type LogEntry = { ts: string; kind: "info" | "success" | "error"; message: string };

function nowTs(): string {
  return new Date().toISOString().slice(11, 19);
}

export type UseMemoryDigest = {
  status: DigestStatus | null;
  draft: string;
  approved: string;
  feedback: string;
  isLoading: boolean;
  activeAction:
    | null
    | "load"
    | "generate"
    | "saveDraft"
    | "saveFeedback"
    | "approve";
  error: string | null;
  log: LogEntry[];
  lastUsage: DigestLLMResult | null;
  draftDirty: boolean;
  feedbackDirty: boolean;
  setDraft(value: string): void;
  setFeedback(value: string): void;
  loadAll(): Promise<void>;
  generateDraft(opts: DigestGenerationOptions): Promise<void>;
  saveDraft(): Promise<void>;
  saveFeedback(): Promise<void>;
  approveDraft(): Promise<void>;
};

export function useMemoryDigest(): UseMemoryDigest {
  const [status, setStatus] = useState<DigestStatus | null>(null);
  const [draft, setDraftState] = useState("");
  const [approved, setApproved] = useState("");
  const [feedback, setFeedbackState] = useState("");
  const [activeAction, setActiveAction] =
    useState<UseMemoryDigest["activeAction"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastUsage, setLastUsage] = useState<DigestLLMResult | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [feedbackDirty, setFeedbackDirty] = useState(false);

  const append = useCallback((kind: LogEntry["kind"], message: string) => {
    setLog((prev) => [...prev.slice(-49), { ts: nowTs(), kind, message }]);
  }, []);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setDraftDirty(true);
  }, []);

  const setFeedback = useCallback((value: string) => {
    setFeedbackState(value);
    setFeedbackDirty(true);
  }, []);

  const loadAll = useCallback(async () => {
    setActiveAction("load");
    setError(null);
    try {
      const [s, d, a, f] = await Promise.all([
        apiCall<DigestStatus>("/api/memory-digest/status"),
        apiCall<{ content: string | null }>("/api/memory-digest/draft"),
        apiCall<{ content: string | null }>("/api/memory-digest/approved"),
        apiCall<{ content: string | null }>("/api/memory-digest/feedback"),
      ]);
      setStatus(s);
      setDraftState(d.content ?? "");
      setApproved(a.content ?? "");
      setFeedbackState(f.content ?? "");
      setDraftDirty(false);
      setFeedbackDirty(false);
      append("info", "Loaded digest workspace.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      append("error", msg);
    } finally {
      setActiveAction(null);
    }
  }, [append]);

  const generateDraft = useCallback(
    async (opts: DigestGenerationOptions) => {
      setActiveAction("generate");
      setError(null);
      try {
        const result = await apiCall<{
          status: DigestStatus;
          draft: string;
          llm: DigestLLMResult;
        }>("/api/memory-digest/draft/generate", {
          method: "POST",
          body: JSON.stringify({
            model: opts.model,
            maxTokens: opts.maxTokens,
            useFeedback: opts.useFeedback,
            usePreviousDraft: opts.usePreviousDraft,
          }),
        });
        setStatus(result.status);
        setDraftState(result.draft);
        setDraftDirty(false);
        setLastUsage(result.llm);
        append("success", `Generated draft with ${opts.model}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        append("error", `Generate failed: ${msg}`);
      } finally {
        setActiveAction(null);
      }
    },
    [append],
  );

  const saveDraft = useCallback(async () => {
    setActiveAction("saveDraft");
    setError(null);
    try {
      const result = await apiCall<{ status: DigestStatus }>(
        "/api/memory-digest/draft",
        {
          method: "PUT",
          body: JSON.stringify({ content: draft }),
        },
      );
      setStatus(result.status);
      setDraftDirty(false);
      append("success", "Draft saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      append("error", `Save draft failed: ${msg}`);
    } finally {
      setActiveAction(null);
    }
  }, [draft, append]);

  const saveFeedback = useCallback(async () => {
    setActiveAction("saveFeedback");
    setError(null);
    try {
      const result = await apiCall<{ status: DigestStatus }>(
        "/api/memory-digest/feedback",
        {
          method: "PUT",
          body: JSON.stringify({ content: feedback }),
        },
      );
      setStatus(result.status);
      setFeedbackDirty(false);
      append("success", "Feedback saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      append("error", `Save feedback failed: ${msg}`);
    } finally {
      setActiveAction(null);
    }
  }, [feedback, append]);

  const approveDraft = useCallback(async () => {
    setActiveAction("approve");
    setError(null);
    try {
      const result = await apiCall<{ status: DigestStatus }>(
        "/api/memory-digest/approve",
        {
          method: "POST",
          body: JSON.stringify({ confirm: true }),
        },
      );
      setStatus(result.status);
      // refresh approved content
      const approvedRes = await apiCall<{ content: string | null }>(
        "/api/memory-digest/approved",
      );
      setApproved(approvedRes.content ?? "");
      append("success", "Draft approved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      append("error", `Approve failed: ${msg}`);
    } finally {
      setActiveAction(null);
    }
  }, [append]);

  useEffect(() => {
    // Defer to a microtask so the initial state update happens outside the
    // synchronous effect body. Avoids the react-hooks/set-state-in-effect rule
    // while still auto-loading once on mount.
    queueMicrotask(() => {
      void loadAll();
    });
  }, [loadAll]);

  return {
    status,
    draft,
    approved,
    feedback,
    isLoading: activeAction === "load",
    activeAction,
    error,
    log,
    lastUsage,
    draftDirty,
    feedbackDirty,
    setDraft,
    setFeedback,
    loadAll,
    generateDraft,
    saveDraft,
    saveFeedback,
    approveDraft,
  };
}
