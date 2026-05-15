import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireAgentJson } from "@/lib/agent-route-helpers";
import { failFromError } from "@/lib/route-helpers";
import { deleteTask, getTask } from "@/server/tasks";

/**
 * POC-07 safety rule: permanent delete requires `{ "confirm": true }` in the
 * request body. Without it, return 409 with a machine-detectable refusal so
 * non-shell clients can detect the guardrail and ask the user to confirm.
 * Prefer reversible status changes (complete / drop) when intent is unclear.
 */
const bodySchema = z.object({
  confirm: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = await requireAgentJson(request, bodySchema);
  if (parsed.error) return parsed.error;

  const { id } = await ctx.params;

  if (parsed.data.confirm !== true) {
    const task = await getTask(id).catch(() => null);
    return fail(
      "Permanent delete requires { confirm: true }. Prefer marking the task done or dropped.",
      409,
      {
        refusal: "confirmation_required",
        task_id: id,
        task_title: task?.title ?? null,
      },
    );
  }

  try {
    const result = await deleteTask(id);
    return ok(result);
  } catch (error) {
    return failFromError("deleteTask", error);
  }
}
