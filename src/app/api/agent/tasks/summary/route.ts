import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { requireAgentAuth } from "@/lib/agent-route-helpers";
import { summarizeTasks } from "@/server/tasks";

const ALLOWED_SCOPES = new Set(["today", "week", "all"]);

export async function GET(request: NextRequest) {
  const unauth = requireAgentAuth(request);
  if (unauth) return unauth;

  const scopeRaw = request.nextUrl.searchParams.get("scope") ?? "all";
  if (!ALLOWED_SCOPES.has(scopeRaw)) {
    return fail("Invalid scope (allowed: today, week, all)", 400);
  }

  try {
    const summary = await summarizeTasks(scopeRaw);
    return ok(summary);
  } catch (error) {
    return fail("summary failed", 500, String(error));
  }
}
