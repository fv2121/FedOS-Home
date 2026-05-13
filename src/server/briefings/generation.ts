import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LLMFirstInsights } from "@/server/intelligence/prompt";
import type { CompactedBriefingSignal } from "@/server/sources/llm-first-signals";

/**
 * Persist one generated briefing run as a `BriefingPackage` plus one
 * `ProposedAction` per item in `proposed_actions`. Performed in a single
 * Prisma transaction.
 *
 * The `payload` JSON intentionally mirrors the LLM-first MVP contract minus
 * `proposed_actions`, which is split out into structured rows so the app can
 * approve, reject, defer, or convert them.
 */

export type PersistBriefingInput = {
  contextMode: string;
  insights: LLMFirstInsights;
  signals: CompactedBriefingSignal[];
  model: string | null;
  promptVersion: string;
  memoryDigestHash: string | null;
  memoryDigestStale: boolean | null;
  memoryDigestApprovedAt: Date | null;
};

export type PersistedBriefing = {
  packageId: string;
  proposedActionIds: string[];
};

function buildSourceRefs(signals: CompactedBriefingSignal[]): Prisma.InputJsonValue {
  return signals.map((s) => ({
    source_type: s.source_type,
    source_id: s.source_id,
    source_ids: s.source_ids ?? null,
    source_link: s.source_link ?? null,
  })) as Prisma.InputJsonValue;
}

export async function persistBriefingPackage(
  input: PersistBriefingInput,
): Promise<PersistedBriefing> {
  const payload = {
    narrative: input.insights.narrative,
    top_priorities: input.insights.top_priorities,
    recommendations: input.insights.recommendations,
    uncertainty: input.insights.uncertainty ?? null,
  } as Prisma.InputJsonValue;

  const sourceRefs = buildSourceRefs(input.signals);

  return prisma.$transaction(async (tx) => {
    const pkg = await tx.briefingPackage.create({
      data: {
        status: "active",
        context_mode: input.contextMode,
        payload,
        source_refs: sourceRefs,
        memory_digest_hash: input.memoryDigestHash,
        memory_digest_stale: input.memoryDigestStale,
        memory_digest_approved_at: input.memoryDigestApprovedAt,
        model: input.model,
        prompt_version: input.promptVersion,
      },
    });

    const proposedActionIds: string[] = [];
    for (const action of input.insights.proposed_actions) {
      const sourceRef = action.signal_id ?? null;
      const created = await tx.proposedAction.create({
        data: {
          briefing_package_id: pkg.id,
          title: action.action,
          description: action.context,
          suggested_source_ref: sourceRef,
          source_refs: sourceRef
            ? ([{ signal_id: sourceRef }] as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
      proposedActionIds.push(created.id);
    }

    return { packageId: pkg.id, proposedActionIds };
  });
}
