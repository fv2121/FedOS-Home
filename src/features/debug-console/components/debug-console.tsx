"use client";

import { useMemo, useState } from "react";
import { useDebugConsoleRun } from "../hooks/use-debug-console-run";
import {
  DEBUG_MODEL_OPTIONS,
  DEFAULT_DEBUG_INPUT,
  type DebugConsoleInput,
  type DebugResult,
} from "../model/debug-console-types";

type InspectionTab = "signals" | "prompt" | "memory" | "json";

const PIPELINE_STEPS = [
  { id: 1, label: "Outlook fetch" },
  { id: 2, label: "Normalize" },
  { id: 3, label: "Hygiene" },
  { id: 4, label: "Memory digest" },
  { id: 5, label: "Prompt budget" },
  { id: 6, label: "LLM output" },
  { id: 7, label: "Persist" },
];

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function tokenStatusTag(status: DebugResult["outlook"]["tokenStatus"]) {
  const tone =
    status === "ok"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : status === "missing"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
  const label =
    status === "ok"
      ? "Token OK"
      : status === "missing"
        ? "Token missing"
        : status === "expired"
          ? "Token expired"
          : "Refresh failed";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function digestTag(used: DebugResult["memoryDigest"]["used"], stale: boolean) {
  if (used === "digest") {
    const tone = stale
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
        {stale ? "Digest stale" : "Digest fresh"}
      </span>
    );
  }
  if (used === "full") {
    return (
      <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
        Full memory
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
      No memory
    </span>
  );
}

function PipelineStrip({
  result,
  persist,
  highlightLLM,
}: {
  result: DebugResult | null;
  persist: boolean;
  highlightLLM: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {PIPELINE_STEPS.map((step) => {
        let active = false;
        let warn = false;
        if (result) {
          if (step.id <= 4) active = true;
          if (step.id === 5) {
            active = true;
            warn = result.prompt.estimatedInputTokens > 8000;
          }
          if (step.id === 6) active = highlightLLM;
          if (step.id === 7) active = persist;
        }
        const tone = warn
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : active
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-[var(--color-line)] bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]";
        return (
          <div
            key={step.id}
            className={`rounded-md border px-3 py-2 text-xs ${tone}`}
          >
            <div className="font-mono text-[10px] opacity-60">
              {String(step.id).padStart(2, "0")}
            </div>
            <div className="mt-0.5 font-medium">
              {step.id === 7 ? `Persist ${persist ? "on" : "off"}` : step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-[var(--color-text-tertiary)]">{sub}</div>
      ) : null}
    </div>
  );
}

function SignalsTab({ result }: { result: DebugResult }) {
  const displayedSignals = result.signalSample.length;
  const finalSignals = result.stats.finalCount;

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Signal sample</h3>
          <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
            redacted
          </span>
        </div>
        <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
          Showing first {formatInt(displayedSignals)} of{" "}
          {formatInt(finalSignals)} final signals. This view is sampled and
          redacted for inspection.
        </p>
        <div className="overflow-x-auto rounded-md border border-[var(--color-line)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-tertiary)]">
              <tr>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Preview</th>
              </tr>
            </thead>
            <tbody>
              {result.signalSample.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-center text-[var(--color-text-tertiary)]"
                  >
                    No signals to display.
                  </td>
                </tr>
              ) : (
                result.signalSample.map((s, index) => {
                  const previewChars =
                    typeof s.metadata.body_preview_chars === "number"
                      ? `${s.metadata.body_preview_chars} chars`
                      : Array.isArray(s.metadata.attendee_emails)
                        ? `${(s.metadata.attendee_emails as unknown[]).length} attendees`
                        : "—";
                  const time = s.timestamp
                    ? new Date(s.timestamp).toISOString().slice(11, 16)
                    : "—";
                  return (
                    <tr
                      key={`${s.source_type}-${s.source_id}-${index}`}
                      className="border-t border-[var(--color-line)]"
                    >
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[10px] font-medium uppercase">
                          {s.source_type.replace("outlook_", "")}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">{s.title}</td>
                      <td className="px-3 py-2 align-top tabular-nums whitespace-nowrap text-[var(--color-text-tertiary)]">
                        {time}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-[var(--color-text-tertiary)]">
                        {previewChars}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
          {formatInt(result.stats.hygieneExcluded)} excluded ·{" "}
          {formatInt(result.stats.duplicates)} duplicates ·{" "}
          {formatInt(result.stats.collapsed)} collapsed into{" "}
          {formatInt(result.stats.groups)} group
          {result.stats.groups === 1 ? "" : "s"}
        </div>
      </div>

      {result.outlook.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="font-semibold">Outlook warnings</div>
          <ul className="ml-4 list-disc">
            {result.outlook.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PromptTab({ result }: { result: DebugResult }) {
  const previewSections = [
    {
      label: "SYSTEM",
      text: result.prompt.blocks.staticInstructions,
      limit: 800,
    },
    {
      label: "STABLE CONTEXT",
      text: result.prompt.blocks.stableContext,
      limit: 800,
    },
    {
      label: "DYNAMIC SIGNALS",
      text: result.prompt.blocks.dynamicSignals,
      limit: 1200,
    },
  ];
  const rows = [
    { label: "System prompt", chars: result.prompt.systemChars },
    { label: "Stable context", chars: result.prompt.stableChars },
    { label: "Dynamic signals", chars: result.prompt.dynamicChars },
    { label: "Total input", chars: result.prompt.userMessageChars + result.prompt.systemChars },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Prompt budget</h3>
        <div className="overflow-x-auto rounded-md border border-[var(--color-line)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface-secondary)] text-left text-[var(--color-text-tertiary)]">
              <tr>
                <th className="px-3 py-2 font-medium">Block</th>
                <th className="px-3 py-2 font-medium text-right">Chars</th>
                <th className="px-3 py-2 font-medium text-right">
                  Token estimate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-[var(--color-line)]">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatInt(r.chars)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatInt(Math.ceil(r.chars / 4))}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[var(--color-line)] bg-[var(--color-surface-secondary)]">
                <td className="px-3 py-2 font-medium">Max output</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-tertiary)]">
                  n/a
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatInt(result.maxTokens)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Prompt blocks preview</h3>
        <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
          Preview only. Full prompt blocks are sent to the LLM.
        </p>
        <pre className="max-h-96 overflow-auto rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 text-[11px] leading-snug whitespace-pre-wrap break-words">
{previewSections
  .map((section) => {
    const displayed = Math.min(section.text.length, section.limit);
    const truncated = section.text.length > section.limit;
    return `${section.label} (${formatInt(displayed)} of ${formatInt(section.text.length)} chars shown)
${section.text.slice(0, section.limit)}${truncated ? "\n..." : ""}`;
  })
  .join("\n\n")}
        </pre>
      </div>
    </div>
  );
}

function MemoryTab({ result }: { result: DebugResult }) {
  const { memoryDigest } = result;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Memory status</h3>
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Mode used
              </td>
              <td className="py-1.5">{memoryDigest.used}</td>
            </tr>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Available
              </td>
              <td className="py-1.5">{memoryDigest.available ? "yes" : "no"}</td>
            </tr>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Stale
              </td>
              <td className="py-1.5">{memoryDigest.stale ? "yes" : "no"}</td>
            </tr>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Approved at
              </td>
              <td className="py-1.5">{memoryDigest.approvedAt ?? "—"}</td>
            </tr>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Approved hash
              </td>
              <td className="py-1.5 font-mono text-[10px]">
                {memoryDigest.approvedHash
                  ? `${memoryDigest.approvedHash.slice(0, 12)}…`
                  : "—"}
              </td>
            </tr>
            <tr className="border-t border-[var(--color-line)]">
              <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                Current memory hash
              </td>
              <td className="py-1.5 font-mono text-[10px]">
                {memoryDigest.sourceHash
                  ? `${memoryDigest.sourceHash.slice(0, 12)}…`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Digest prompt block</h3>
        <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
          Scrollable memory prompt block used for this run.
        </p>
        <pre className="max-h-96 overflow-auto rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 text-[11px] leading-snug whitespace-pre-wrap break-words">
          {result.prompt.blocks.stableContext || "(no memory context loaded)"}
        </pre>
      </div>
    </div>
  );
}

function JsonTab({ result, persist }: { result: DebugResult; persist: boolean }) {
  const payload = useMemo(() => {
    const base = {
      mode: "debug_console",
      kind: result.kind,
      dry_run: result.kind === "run" ? !result.persist : true,
      persist_requested: persist,
      context_mode: result.contextMode,
      model: result.model,
      max_tokens: result.maxTokens,
      outlook: result.outlook,
      stats: result.stats,
      memory_digest: result.memoryDigest,
      prompt: {
        system_chars: result.prompt.systemChars,
        stable_chars: result.prompt.stableChars,
        dynamic_chars: result.prompt.dynamicChars,
        user_message_chars: result.prompt.userMessageChars,
        estimated_input_tokens: result.prompt.estimatedInputTokens,
      },
      warnings: result.warnings,
      signal_sample: result.signalSample,
    } as Record<string, unknown>;
    if (result.kind === "run") {
      base.insights = result.insights;
      base.llm = result.llm;
      base.persisted = result.persisted;
    }
    return base;
  }, [result, persist]);

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Debug run payload</h3>
      <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
        Redacted debug payload for the UI. Not the full Microsoft Graph
        response or full LLM prompt.
      </p>
      <pre className="max-h-[36rem] overflow-auto rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 text-[11px] leading-snug">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

function ResultPanel({
  result,
  log,
}: {
  result: DebugResult | null;
  log: Array<{ ts: string; kind: string; message: string }>;
}) {
  const isRun = result?.kind === "run";
  const insights = isRun ? result.insights : null;

  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">LLM result</h2>
        {isRun ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            Valid JSON
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
            Awaiting run
          </span>
        )}
      </div>

      {!insights ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Run preflight to inspect the prepared pipeline, then `Run real LLM` to
          generate a briefing.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          {insights.narrative ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Narrative
              </h3>
              <p className="mt-1 text-[var(--color-text-primary)]">
                {insights.narrative}
              </p>
            </section>
          ) : null}

          {insights.top_priorities && insights.top_priorities.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Top priorities
              </h3>
              <ol className="mt-2 space-y-2">
                {insights.top_priorities.map((p, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-2"
                  >
                    <div className="font-medium">{p.title}</div>
                    {p.why ? (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {p.why}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {insights.recommendations && insights.recommendations.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Recommendations
              </h3>
              <ul className="mt-1 list-disc pl-5">
                {insights.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {insights.proposed_actions && insights.proposed_actions.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Proposed actions
              </h3>
              <ul className="mt-2 space-y-2">
                {insights.proposed_actions.map((a, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        suggested
                      </span>
                    </div>
                    {a.context ? (
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {a.context}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {insights.uncertainty ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Uncertainty
              </h3>
              <p className="mt-1 text-[var(--color-text-tertiary)]">
                {insights.uncertainty}
              </p>
            </section>
          ) : null}

          <div
            className={`rounded-md border p-2 text-xs ${
              result && result.kind === "run" && result.persist && result.persisted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            }`}
          >
            {result && result.kind === "run" && result.persist && result.persisted
              ? `Persisted package ${result.persisted.packageId} with ${result.persisted.proposedActionIds.length} proposed action row(s).`
              : "Dry run result. No briefing package or durable tasks were created."}
          </div>
        </div>
      )}

      {log.length > 0 ? (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Run log
          </h3>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
            {log.map((entry, i) => (
              <li
                key={i}
                className={
                  entry.kind === "error"
                    ? "text-red-600 dark:text-red-300"
                    : entry.kind === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-[var(--color-text-tertiary)]"
                }
              >
                <span className="opacity-60">{entry.ts}</span> {entry.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function DebugConsole() {
  const [input, setInput] = useState<DebugConsoleInput>(DEFAULT_DEBUG_INPUT);
  const [tab, setTab] = useState<InspectionTab>("signals");
  const run = useDebugConsoleRun();

  function update<K extends keyof DebugConsoleInput>(
    key: K,
    value: DebugConsoleInput[K],
  ) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const result = run.result;
  const isRun = result?.kind === "run";

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-10">
      <div className="w-full px-6 py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Debug Console
            </h1>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Run the Home intelligence pipeline end-to-end and inspect every
              stage before persisting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result ? tokenStatusTag(result.outlook.tokenStatus) : null}
            {result ? digestTag(result.memoryDigest.used, result.memoryDigest.stale) : null}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                input.persist
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
              }`}
            >
              {input.persist ? "Persist on" : "Dry run"}
            </span>
            {result ? (
              <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                {result.model}
              </span>
            ) : null}
            {result ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                Prompt {formatInt(result.prompt.userMessageChars + result.prompt.systemChars)} chars
              </span>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Control panel */}
          <aside className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Run controls</h2>
            <div className="space-y-4 text-sm">
              <div className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Model
                </span>
                <div
                  role="radiogroup"
                  aria-label="Model"
                  className="mt-1 inline-flex w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-0.5"
                >
                  {DEBUG_MODEL_OPTIONS.map((opt) => {
                    const selected = input.model === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update("model", opt.value)}
                        className={`flex-1 rounded px-2 py-1 text-xs font-medium transition ${
                          selected
                            ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Max tokens
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={64000}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1.5 text-sm tabular-nums"
                    value={input.maxTokens}
                    onChange={(e) =>
                      update("maxTokens", Number(e.target.value) || 0)
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Mode
                  </span>
                  <select
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1.5 text-sm"
                    value={input.contextMode}
                    onChange={(e) => update("contextMode", e.target.value)}
                  >
                    <option value="business">business</option>
                    <option value="personal">personal</option>
                  </select>
                </label>
              </div>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={input.useFullMemory}
                  onChange={(e) => update("useFullMemory", e.target.checked)}
                />
                <span>
                  <span className="block font-medium">Use full Memory files</span>
                  <span className="block text-xs text-[var(--color-text-tertiary)]">
                    Default uses the approved digest. Turn on only to compare
                    against the full Memory source.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={input.persist}
                  onChange={(e) => update("persist", e.target.checked)}
                />
                <span>
                  <span className="block font-medium">Save briefing package</span>
                  <span className="block text-xs text-[var(--color-text-tertiary)]">
                    Default is dry run. Turn on to create a real briefing and
                    proposed-action rows.
                  </span>
                </span>
              </label>

              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Source windows
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      Mail days
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className="mt-0.5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1 text-sm tabular-nums"
                      value={input.mailLookbackDays}
                      onChange={(e) =>
                        update("mailLookbackDays", Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      Calendar days
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      className="mt-0.5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1 text-sm tabular-nums"
                      value={input.calendarLookaheadDays}
                      onChange={(e) =>
                        update(
                          "calendarLookaheadDays",
                          Number(e.target.value) || 0,
                        )
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      Mail max
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      className="mt-0.5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1 text-sm tabular-nums"
                      value={input.mailMaxResults}
                      onChange={(e) =>
                        update("mailMaxResults", Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      Calendar max
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      className="mt-0.5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1 text-sm tabular-nums"
                      value={input.calendarMaxResults}
                      onChange={(e) =>
                        update(
                          "calendarMaxResults",
                          Number(e.target.value) || 0,
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={input.includeBodyPreviews}
                  onChange={(e) =>
                    update("includeBodyPreviews", e.target.checked)
                  }
                />
                <span>
                  <span className="block font-medium">Body previews</span>
                  <span className="block text-xs text-[var(--color-text-tertiary)]">
                    Capped at 300 characters and used as additional signal
                    context.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={run.isRunning}
                onClick={() => run.runPreflight(input)}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {run.activeAction === "preflight"
                  ? "Estimating…"
                  : "Estimate and preview"}
              </button>
              <button
                type="button"
                disabled={run.isRunning}
                onClick={() => run.runReal(input)}
                className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {run.activeAction === "run" ? "Running…" : "Run real LLM"}
              </button>
              <button
                type="button"
                disabled={run.isRunning}
                onClick={run.clear}
                className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
              >
                Clear result
              </button>
              {run.error ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {run.error}
                </div>
              ) : null}
            </div>
          </aside>

          {/* Main */}
          <div className="space-y-5 xl:col-span-2">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                label="Mail"
                value={result ? formatInt(result.outlook.rawCounts.mail) : "—"}
                sub={`last ${input.mailLookbackDays}d`}
              />
              <MetricCard
                label="Calendar"
                value={
                  result ? formatInt(result.outlook.rawCounts.calendar) : "—"
                }
                sub={`next ${input.calendarLookaheadDays}d`}
              />
              <MetricCard
                label="Excluded"
                value={result ? formatInt(result.stats.hygieneExcluded) : "—"}
                sub="hygiene"
              />
              <MetricCard
                label="To LLM"
                value={result ? formatInt(result.stats.finalCount) : "—"}
                sub="after compaction"
              />
              <MetricCard
                label="Input tokens"
                value={
                  result
                    ? formatInt(result.prompt.estimatedInputTokens)
                    : "—"
                }
                sub="estimate"
              />
              <MetricCard
                label="Cost"
                value={
                  isRun && result.llm?.usage?.cost_usd != null
                    ? `$${result.llm.usage.cost_usd.toFixed(4)}`
                    : result && result.prompt.estimatedCostUsd != null
                      ? `$${result.prompt.estimatedCostUsd.toFixed(4)}`
                      : "—"
                }
                sub={
                  isRun && result.llm?.usage?.cost_usd != null
                    ? result.llm.usage.cost_approximate
                      ? "approx"
                      : "actual"
                    : result && result.prompt.estimatedCostUsd != null
                      ? "max estimate"
                      : "estimate unavailable"
                }
              />
            </div>

            {/* Pipeline strip */}
            <PipelineStrip
              result={result}
              persist={input.persist}
              highlightLLM={isRun}
            />

            {/* Inspection + Result side-by-side */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* Inspection */}
            <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Inspection</h2>
                <div className="flex gap-1 text-xs">
                  {(["signals", "prompt", "memory", "json"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`rounded-md border px-2 py-1 capitalize ${
                          tab === t
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                            : "border-[var(--color-line)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {t === "json" ? "Debug JSON" : t}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {!result ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Run preflight to populate inspection panels.
                </p>
              ) : tab === "signals" ? (
                <SignalsTab result={result} />
              ) : tab === "prompt" ? (
                <PromptTab result={result} />
              ) : tab === "memory" ? (
                <MemoryTab result={result} />
              ) : (
                <JsonTab result={result} persist={input.persist} />
              )}

              {result && result.warnings.length > 0 ? (
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                  <div className="font-semibold">Pipeline warnings</div>
                  <ul className="ml-4 list-disc">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* Result */}
            <ResultPanel result={result} log={run.log} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
