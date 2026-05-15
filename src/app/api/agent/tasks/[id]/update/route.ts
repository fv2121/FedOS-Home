import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAgentJson } from "@/lib/agent-route-helpers";
import { failFromError } from "@/lib/route-helpers";
import { updateTask } from "@/server/tasks";
import { updateTaskSchema } from "@/lib/validators";
import { z } from "zod";

const bodySchema = updateTaskSchema.extend({
  reason: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = await requireAgentJson(request, bodySchema);
  if (parsed.error) return parsed.error;

  const { id } = await ctx.params;
  const { reason, ...fields } = parsed.data;

  try {
    const task = await updateTask(id, fields, "llm", reason);
    return ok(task);
  } catch (error) {
    return failFromError("updateTask", error);
  }
}
