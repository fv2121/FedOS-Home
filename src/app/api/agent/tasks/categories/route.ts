import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { listCategories } from "@/server/tasks";

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  try {
    const categories = await listCategories();
    return ok(categories);
  } catch (error) {
    return fail("categories failed", 500, String(error));
  }
}
