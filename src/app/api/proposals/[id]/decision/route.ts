import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";
import {
  decideProposedAction,
  ProposedActionAlreadyDecidedError,
  ProposedActionNotFoundError,
} from "@/server/proposals";

const taskOverridesSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullish(),
    status: z.enum(["active", "waiting", "deferred", "done", "dropped"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    category_id: z.string().optional(),
    project_id: z.string().nullish(),
    owner: z.string().optional(),
    due_at: z.string().nullish(),
    source_type: z.enum(["manual", "email", "calendar", "message", "llm", "fedos"]).optional(),
    source_ref: z.string().nullish(),
    tags: z.array(z.string()).optional(),
  })
  .optional();

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected", "deferred"]),
  decision_reason: z.string().nullish(),
  task: taskOverridesSchema,
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = await requireJson(request, bodySchema);
  if (parsed.error) return parsed.error;

  const { id } = await ctx.params;

  try {
    const result = await decideProposedAction({
      proposalId: id,
      decision: parsed.data.decision,
      decisionReason: parsed.data.decision_reason ?? null,
      taskOverrides: parsed.data.task,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof ProposedActionNotFoundError) {
      return fail("Proposed action not found", 404);
    }
    if (error instanceof ProposedActionAlreadyDecidedError) {
      return fail(error.message, 409);
    }
    return failFromError("decideProposedAction", error);
  }
}
