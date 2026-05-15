import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

/**
 * POC-07 agent bearer-token auth.
 *
 * Mobile/remote LLM clients cannot send the browser session cookie, so the
 * `/api/agent/*` surface is gated by a separate shared secret:
 *   Authorization: Bearer $FEDOS_AGENT_TOKEN
 *
 * Token scope is intentionally limited to task operations exposed under
 * `/api/agent/tasks`. Browser cookie auth on `/api/llm/*` is unaffected.
 */
const HEADER = "authorization";
const PREFIX = "Bearer ";

function configuredToken(): string | null {
  const token = process.env.FEDOS_AGENT_TOKEN;
  if (!token || token.trim().length === 0) return null;
  return token.trim();
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function requestHasAgentAuth(request: NextRequest): boolean {
  const expected = configuredToken();
  if (!expected) return false;

  const header = request.headers.get(HEADER);
  if (!header || !header.startsWith(PREFIX)) return false;

  const presented = header.slice(PREFIX.length).trim();
  if (presented.length === 0) return false;

  return safeEqual(presented, expected);
}
