import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth, requireAgentJson } from "@/lib/agent-route-helpers";
import { createTask, getTask, searchTasks } from "@/server/tasks";
import { createTaskSchema, taskFilterSchema } from "@/lib/validators";
import { failFromError } from "@/lib/route-helpers";

/**
 * POC-07: List/search tasks with optional filters and create new tasks.
 *
 * GET  /api/agent/tasks            -> filterable list (mirrors searchTasks)
 * POST /api/agent/tasks            -> create a task (actor=llm)
 */

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = taskFilterSchema.safeParse(params);
  if (!parsed.success) {
    return fail("Invalid filters", 400, parsed.error.flatten());
  }

  try {
    const tasks = await searchTasks(parsed.data);
    return ok(tasks);
  } catch (error) {
    return fail("list failed", 500, String(error));
  }
}

const createBodySchema = createTaskSchema;

export async function POST(request: NextRequest) {
  const parsed = await requireAgentJson(request, createBodySchema);
  if (parsed.error) return parsed.error;

  try {
    const created = await createTask(parsed.data, "llm");
    const refreshed = (await getTask(created.id)) ?? created;
    return ok(refreshed, { status: 201 });
  } catch (error) {
    return failFromError("createTask", error);
  }
}
