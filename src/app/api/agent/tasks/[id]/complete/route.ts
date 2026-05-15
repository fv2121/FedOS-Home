import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAgentJson } from "@/lib/agent-route-helpers";
import { failFromError } from "@/lib/route-helpers";
import { completeTask } from "@/server/tasks";
import { completeTaskSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = await requireAgentJson(request, completeTaskSchema);
  if (parsed.error) return parsed.error;

  const { id } = await ctx.params;

  try {
    const task = await completeTask(id, parsed.data.reason, "llm");
    return ok(task);
  } catch (error) {
    return failFromError("completeTask", error);
  }
}
