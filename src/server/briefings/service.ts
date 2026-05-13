import { prisma } from "@/lib/prisma";
import {
  generateBriefingPackage,
  type GenerateBriefingInput,
  type GeneratedBriefingPackage,
} from "@/server/intelligence";

/**
 * Read and orchestration helpers for briefing packages used by the API layer.
 * Persistence of generation runs lives in `@/server/briefings/generation`;
 * this module exposes thin product-facing service entry points.
 */

type ProposalDecisionStatus = "pending" | "approved" | "rejected" | "deferred";

export type BriefingPackageListItem = Awaited<
  ReturnType<typeof listBriefingPackages>
>[number];

export async function listBriefingPackages(options: { limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
  const packages = await prisma.briefingPackage.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      proposed_actions: { select: { status: true } },
    },
  });

  return packages.map((pkg) => {
    const counts: Record<ProposalDecisionStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      deferred: 0,
    };
    for (const action of pkg.proposed_actions) {
      counts[action.status as ProposalDecisionStatus] += 1;
    }
    return {
      id: pkg.id,
      status: pkg.status,
      context_mode: pkg.context_mode,
      created_at: pkg.created_at,
      updated_at: pkg.updated_at,
      model: pkg.model,
      prompt_version: pkg.prompt_version,
      memory_digest: {
        hash: pkg.memory_digest_hash,
        stale: pkg.memory_digest_stale,
        approved_at: pkg.memory_digest_approved_at,
      },
      proposed_action_counts: counts,
      proposed_action_total: pkg.proposed_actions.length,
    };
  });
}

export async function getBriefingPackage(id: string) {
  const pkg = await prisma.briefingPackage.findUnique({
    where: { id },
    include: {
      proposed_actions: {
        orderBy: [{ status: "asc" }, { created_at: "asc" }],
        include: { approved_task: true },
      },
    },
  });
  return pkg;
}

export async function runBriefingGeneration(
  input: GenerateBriefingInput,
): Promise<GeneratedBriefingPackage> {
  return generateBriefingPackage(input);
}
