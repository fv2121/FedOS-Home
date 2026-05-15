import { NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { fail } from "@/lib/http";
import { requestHasAgentAuth } from "@/lib/agent-auth";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * POC-07 helpers for the agent HTTP adapter.
 *
 * Mirrors `src/lib/route-helpers.ts` but enforces the bearer token used by
 * mobile/remote LLM clients. Routes under `/api/agent/*` should use these
 * helpers exclusively so the auth contract stays consistent.
 *
 * POC-09: Rate limiting is applied inside these helpers so individual route
 * files need no changes. Reads: 200/5 min per IP. Writes: 60/5 min per IP.
 */

// 200 read requests per 5 minutes per IP
const agentReadLimit = createRateLimiter(200, 5 * 60 * 1000);
// 60 write requests per 5 minutes per IP
const agentWriteLimit = createRateLimiter(60, 5 * 60 * 1000);

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function requireAgentAuth(request: NextRequest) {
  if (!requestHasAgentAuth(request)) {
    return fail("Unauthorized", 401);
  }
  if (agentReadLimit(clientIp(request))) {
    return fail("Too many requests", 429);
  }
  return null;
}

export async function requireAgentJson<T>(request: NextRequest, schema: ZodSchema<T>) {
  if (!requestHasAgentAuth(request)) {
    return { error: fail("Unauthorized", 401) };
  }
  if (agentWriteLimit(clientIp(request))) {
    return { error: fail("Too many requests", 429) };
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return { error: fail("Invalid request", 400, parsed.error.flatten()) };
  }

  return { data: parsed.data };
}
