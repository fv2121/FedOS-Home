"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Clock, X } from "lucide-react";
import type { BriefingProposedAction } from "../model/briefing-types";
import { useBriefingActions } from "../hooks/use-briefing-actions";

type Props = {
  proposal: BriefingProposedAction;
  actions: ReturnType<typeof useBriefingActions>;
};

const STATUS_LABEL: Record<BriefingProposedAction["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
};

const STATUS_TONE: Record<BriefingProposedAction["status"], string> = {
  pending: "border-[var(--color-line)] bg-[var(--color-panel)]",
  approved: "border-emerald-500/30 bg-emerald-500/5",
  rejected: "border-red-500/30 bg-red-500/5",
  deferred: "border-amber-500/30 bg-amber-500/5",
};

export function ProposedActionCard({ proposal, actions }: Props) {
  const [reason, setReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState<"rejected" | "deferred" | null>(null);
  const isPending = proposal.status === "pending";
  const inFlight = actions.pendingProposalId === proposal.id;

  async function handleApprove() {
    await actions.decide({ proposalId: proposal.id, decision: "approved" });
  }

  async function handleReasonSubmit() {
    if (!reasonOpen) return;
    const ok = await actions.decide({
      proposalId: proposal.id,
      decision: reasonOpen,
      decisionReason: reason.trim() || undefined,
    });
    if (ok) {
      setReason("");
      setReasonOpen(null);
    }
  }

  return (
    <article
      className={clsx(
        "rounded-2xl border p-4 transition md:p-5",
        STATUS_TONE[proposal.status],
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-[var(--color-text-primary)]">
          {proposal.title}
        </h4>
        <span
          className={clsx(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            proposal.status === "pending"
              ? "bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]"
              : proposal.status === "approved"
                ? "bg-emerald-500/15 text-emerald-300"
                : proposal.status === "rejected"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-amber-500/15 text-amber-300",
          )}
        >
          {STATUS_LABEL[proposal.status]}
        </span>
      </header>

      {proposal.description ? (
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
          {proposal.description}
        </p>
      ) : null}

      {proposal.rationale ? (
        <p className="mb-3 text-sm italic text-[var(--color-text-tertiary)]">
          {proposal.rationale}
        </p>
      ) : null}

      {!isPending && proposal.decision_reason ? (
        <p className="mb-3 text-xs text-[var(--color-text-tertiary)]">
          Reason: {proposal.decision_reason}
        </p>
      ) : null}

      {!isPending && proposal.approved_task ? (
        <p className="mb-3 text-xs text-emerald-300">
          Approved into Tasks ·{" "}
          <span className="text-[var(--color-text-secondary)]">
            {proposal.approved_task.title}
          </span>
        </p>
      ) : null}

      {isPending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={inFlight}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => setReasonOpen("rejected")}
            disabled={inFlight}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
          <button
            type="button"
            onClick={() => setReasonOpen("deferred")}
            disabled={inFlight}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" />
            Defer
          </button>
        </div>
      )}

      {isPending && reasonOpen && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-3">
          <label
            htmlFor={`reason-${proposal.id}`}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
          >
            {reasonOpen === "rejected" ? "Why reject?" : "Why defer?"} (optional)
          </label>
          <textarea
            id={`reason-${proposal.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReasonSubmit}
              disabled={inFlight}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--color-surface-primary)] disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setReason("");
                setReasonOpen(null);
              }}
              disabled={inFlight}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
