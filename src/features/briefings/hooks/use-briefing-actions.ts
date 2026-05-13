"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposalDecisionStatus } from "../model/briefing-types";

type DecisionPayload =
  | { decision: "approved" }
  | { decision: "rejected"; decision_reason?: string }
  | { decision: "deferred"; decision_reason?: string };

export type DecideArgs = {
  proposalId: string;
  decision: ProposalDecisionStatus extends infer S
    ? S extends "pending"
      ? never
      : S
    : never;
  decisionReason?: string;
};

export function useBriefingActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);

  async function decide(args: DecideArgs): Promise<boolean> {
    setError(null);
    setPendingProposalId(args.proposalId);

    const body: DecisionPayload =
      args.decision === "approved"
        ? { decision: "approved" }
        : args.decision === "rejected"
          ? { decision: "rejected", decision_reason: args.decisionReason }
          : { decision: "deferred", decision_reason: args.decisionReason };

    try {
      const res = await fetch(
        `/api/proposals/${encodeURIComponent(args.proposalId)}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || payload?.ok === false) {
        setError(payload?.error ?? "Decision failed");
        return false;
      }

      startTransition(() => router.refresh());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
      return false;
    } finally {
      setPendingProposalId(null);
    }
  }

  return {
    decide,
    error,
    clearError: () => setError(null),
    isPending,
    pendingProposalId,
  };
}
