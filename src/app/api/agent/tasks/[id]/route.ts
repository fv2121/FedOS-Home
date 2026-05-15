import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { getTask } from "@/server/tasks";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  const { id } = await ctx.params;

  try {
    const task = await getTask(id);
    if (!task) return fail("Task not found", 404);
    return ok(task);
  } catch (error) {
    return fail("getTask failed", 500, String(error));
  }
}
