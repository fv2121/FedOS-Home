import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";
import { runDebugBriefing } from "@/server/debug";
import { debugRequestToServiceInput, debugRunRequestSchema } from "../_schema";

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, debugRunRequestSchema);
  if (parsed.error) return parsed.error;

  try {
    const result = await runDebugBriefing(
      debugRequestToServiceInput(parsed.data),
    );
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
      return fail("LLM provider is not configured", 503, error.message);
    }
    if (error instanceof Error && error.message.includes("Anthropic SDK is not installed")) {
      return fail("LLM provider SDK is not installed", 503, error.message);
    }
    return failFromError("Debug run", error);
  }
}

export async function GET() {
  return fail("Method not allowed", 405);
}
