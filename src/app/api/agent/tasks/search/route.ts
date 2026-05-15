import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { searchTasks } from "@/server/tasks";

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return fail("Missing query parameter 'q'", 400);
  }

  try {
    const tasks = await searchTasks({ q });
    return ok(tasks);
  } catch (error) {
    return fail("search failed", 500, String(error));
  }
}
