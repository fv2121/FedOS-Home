"use client";

import { useCallback, useState } from "react";
import {
  debugInputToRequest,
  type DebugConsoleInput,
  type DebugResult,
} from "../model/debug-console-types";

type RunLogEntry = {
  ts: string;
  kind: "info" | "error" | "success";
  message: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
};

async function callDebugRoute<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json?.ok || !json.data) {
    const detail = typeof json?.details === "string" ? `: ${json.details}` : "";
    const message = `${json?.error ?? `Request failed (${res.status})`}${detail}`;
    throw new Error(message);
  }
  return json.data;
}

function nowTs(): string {
  const d = new Date();
  return d.toISOString().slice(11, 19);
}

export function useDebugConsoleRun() {
  const [result, setResult] = useState<DebugResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeAction, setActiveAction] = useState<"preflight" | "run" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<RunLogEntry[]>([]);

  const append = useCallback((entry: Omit<RunLogEntry, "ts">) => {
    setLog((prev) => [...prev, { ts: nowTs(), ...entry }]);
  }, []);

  const runPreflight = useCallback(
    async (input: DebugConsoleInput) => {
      if (isRunning) return;
      setIsRunning(true);
      setActiveAction("preflight");
      setError(null);
      append({ kind: "info", message: "Preflight requested." });
      try {
        const data = await callDebugRoute<DebugResult>(
          "/api/debug/intelligence/preflight",
          debugInputToRequest(input),
        );
        setResult(data);
        append({
          kind: "success",
          message: `Preflight ok — mail=${data.outlook.rawCounts.mail} calendar=${data.outlook.rawCounts.calendar} final=${data.stats.finalCount}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        append({ kind: "error", message: `Preflight failed: ${message}` });
      } finally {
        setIsRunning(false);
        setActiveAction(null);
      }
    },
    [append, isRunning],
  );

  const runReal = useCallback(
    async (input: DebugConsoleInput) => {
      if (isRunning) return;
      setIsRunning(true);
      setActiveAction("run");
      setError(null);
      append({
        kind: "info",
        message: input.persist
          ? "Running real LLM with persistence on."
          : "Running real LLM (dry run).",
      });
      try {
        const data = await callDebugRoute<DebugResult>(
          "/api/debug/intelligence/run",
          debugInputToRequest(input),
        );
        setResult(data);
        if (data.kind === "run" && data.persisted) {
          append({
            kind: "success",
            message: `Persisted package ${data.persisted.packageId} with ${data.persisted.proposedActionIds.length} proposed action(s).`,
          });
        } else {
          append({
            kind: "success",
            message: "LLM returned valid briefing JSON (dry run).",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        append({ kind: "error", message: `Run failed: ${message}` });
      } finally {
        setIsRunning(false);
        setActiveAction(null);
      }
    },
    [append, isRunning],
  );

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setLog([]);
  }, []);

  return {
    result,
    error,
    log,
    isRunning,
    activeAction,
    runPreflight,
    runReal,
    clear,
  };
}
