"use client";

import { useState } from "react";
import { useMemoryDigest } from "../hooks/use-memory-digest";
import {
  DEFAULT_GENERATION_OPTIONS,
  DIGEST_MODEL_OPTIONS,
  type DigestGenerationOptions,
  type DigestModelValue,
  type DigestStatus,
} from "../model/memory-digest-types";

type Tab = "draft" | "approved" | "feedback";

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatusBadge({ status }: { status: DigestStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-tertiary)]">
        Loading…
      </span>
    );
  }
  if (!status.memoryAvailable) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        Memory unavailable
      </span>
    );
  }
  if (!status.approvedPresent) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        No approved digest
      </span>
    );
  }
  if (status.stale) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        Approved · stale
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      Approved · current
    </span>
  );
}

export function MemoryDigestConsole() {
  const m = useMemoryDigest();
  const [tab, setTab] = useState<Tab>("draft");
  const [opts, setOpts] = useState<DigestGenerationOptions>(
    DEFAULT_GENERATION_OPTIONS,
  );

  function updateOpt<K extends keyof DigestGenerationOptions>(
    key: K,
    value: DigestGenerationOptions[K],
  ) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  const status = m.status;
  const busy = m.activeAction !== null;

  async function handleApprove() {
    if (!status?.draftPresent) return;
    const sourceMismatch =
      status.draftHash !== null && status.draftHash !== status.sourceHash;
    const baseMsg = "Approve this draft as the current digest?";
    const warn = sourceMismatch
      ? "\n\nWarning: the draft was generated against a different Memory source hash than is currently loaded. Consider regenerating before approving."
      : "";
    if (!window.confirm(`${baseMsg}${warn}`)) {
      return;
    }
    await m.approveDraft();
  }

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-10">
      <div className="w-full px-6 py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Memory Digest
            </h1>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Generate, review, edit, and approve the digest of FedOS Memory
              that the daily briefing pipeline consumes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {status?.draftPresent ? (
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  status.draftMatchesSource
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {status.draftMatchesSource
                  ? "Draft matches Memory"
                  : "Draft drift"}
              </span>
            ) : null}
            {m.lastUsage?.usage ? (
              <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                {m.lastUsage.usage.input_tokens} in ·{" "}
                {m.lastUsage.usage.output_tokens} out
                {m.lastUsage.usage.cost_usd != null
                  ? ` · $${m.lastUsage.usage.cost_usd.toFixed(4)}`
                  : ""}
              </span>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Control panel */}
          <aside className="space-y-5">
            <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4">
              <h2 className="mb-3 text-sm font-semibold">Generation</h2>
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
                    {DIGEST_MODEL_OPTIONS.map((o) => {
                      const selected = opts.model === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            updateOpt("model", o.value as DigestModelValue)
                          }
                          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition ${
                            selected
                              ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Max tokens
                  </span>
                  <input
                    type="number"
                    min={256}
                    max={16_000}
                    className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1.5 text-sm tabular-nums"
                    value={opts.maxTokens}
                    onChange={(e) =>
                      updateOpt("maxTokens", Number(e.target.value) || 0)
                    }
                  />
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={opts.useFeedback}
                    onChange={(e) =>
                      updateOpt("useFeedback", e.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-medium">Include feedback</span>
                    <span className="block text-xs text-[var(--color-text-tertiary)]">
                      Use saved feedback notes for this regeneration.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={opts.usePreviousDraft}
                    onChange={(e) =>
                      updateOpt("usePreviousDraft", e.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-medium">
                      Include previous draft
                    </span>
                    <span className="block text-xs text-[var(--color-text-tertiary)]">
                      Reference the existing draft so the LLM can improve it.
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || !status?.memoryAvailable}
                  onClick={() => void m.generateDraft(opts)}
                  className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {m.activeAction === "generate"
                    ? "Generating…"
                    : "Generate draft"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void m.loadAll()}
                  className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {m.activeAction === "load" ? "Refreshing…" : "Refresh"}
                </button>
                {m.error ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    {m.error}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4 text-xs">
              <h2 className="mb-2 text-sm font-semibold">Status</h2>
              <table className="w-full">
                <tbody>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Root
                    </td>
                    <td className="py-1.5 font-mono text-[10px] break-all">
                      {status?.root ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Source hash
                    </td>
                    <td
                      className="py-1.5 font-mono text-[10px]"
                      title={status?.sourceHash ?? undefined}
                    >
                      {shortHash(status?.sourceHash)}
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Approved hash
                    </td>
                    <td
                      className="py-1.5 font-mono text-[10px]"
                      title={status?.approvedHash ?? undefined}
                    >
                      {shortHash(status?.approvedHash)}
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Approved at
                    </td>
                    <td className="py-1.5">{formatTime(status?.approvedAt)}</td>
                  </tr>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Draft
                    </td>
                    <td className="py-1.5">
                      {status?.draftPresent ? "present" : "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Feedback
                    </td>
                    <td className="py-1.5">
                      {status?.feedbackPresent ? "present" : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {status && status.filesMissing.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200">
                  <div className="font-semibold">Missing Memory files</div>
                  <ul className="ml-4 list-disc">
                    {status.filesMissing.map((f) => (
                      <li key={f} className="font-mono text-[10px]">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {status && status.warnings.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200">
                  <div className="font-semibold">Warnings</div>
                  <ul className="ml-4 list-disc">
                    {status.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </aside>

          {/* Editors */}
          <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1 text-xs">
                {(
                  [
                    { id: "draft" as const, label: "Draft" },
                    { id: "approved" as const, label: "Approved" },
                    { id: "feedback" as const, label: "Feedback" },
                  ]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-md border px-2 py-1 capitalize ${
                      tab === t.id
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                        : "border-[var(--color-line)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {tab === "draft" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !m.draftDirty}
                      onClick={() => void m.saveDraft()}
                      className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {m.activeAction === "saveDraft"
                        ? "Saving…"
                        : m.draftDirty
                          ? "Save draft"
                          : "Saved"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !status?.draftPresent}
                      onClick={() => void handleApprove()}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {m.activeAction === "approve"
                        ? "Approving…"
                        : "Approve draft"}
                    </button>
                  </>
                ) : null}
                {tab === "feedback" ? (
                  <button
                    type="button"
                    disabled={busy || !m.feedbackDirty}
                    onClick={() => void m.saveFeedback()}
                    className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {m.activeAction === "saveFeedback"
                      ? "Saving…"
                      : m.feedbackDirty
                        ? "Save feedback"
                        : "Saved"}
                  </button>
                ) : null}
              </div>
            </div>

            {tab === "draft" ? (
              <textarea
                spellCheck={false}
                value={m.draft}
                onChange={(e) => m.setDraft(e.target.value)}
                placeholder="No draft yet. Generate one from FedOS Memory using the controls on the left."
                className="h-[60vh] w-full resize-none rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 font-mono text-[12px] leading-snug"
              />
            ) : tab === "approved" ? (
              <pre className="h-[60vh] w-full overflow-auto rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 text-[12px] leading-snug whitespace-pre-wrap break-words">
                {m.approved || "No approved digest yet."}
              </pre>
            ) : (
              <textarea
                spellCheck={false}
                value={m.feedback}
                onChange={(e) => m.setFeedback(e.target.value)}
                placeholder="Notes, corrections, or guidance for the next regeneration."
                className="h-[60vh] w-full resize-none rounded-md border border-[var(--color-line)] bg-[var(--color-surface-secondary)] p-3 font-mono text-[12px] leading-snug"
              />
            )}

            {m.log.length > 0 ? (
              <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Activity
                </h3>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                  {m.log
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((entry, i) => (
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
                        <span className="opacity-60">{entry.ts}</span>{" "}
                        {entry.message}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
