import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { searchTasks } from "@/server/tasks";

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  try {
    const tasks = (await searchTasks({ due: "overdue" })).filter(
      (task) => task.status !== "dropped",
    );
    return ok(tasks);
  } catch (error) {
    return fail("overdue failed", 500, String(error));
  }
}
