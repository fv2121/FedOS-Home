import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { searchTasks } from "@/server/tasks";

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  try {
    const tasks = await searchTasks({ view: "today" });
    return ok(tasks);
  } catch (error) {
    return fail("today failed", 500, String(error));
  }
}
