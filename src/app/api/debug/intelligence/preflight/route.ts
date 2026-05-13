import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";
import { runDebugPreflight } from "@/server/debug";
import { debugRequestToServiceInput, debugRunRequestSchema } from "../_schema";

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, debugRunRequestSchema);
  if (parsed.error) return parsed.error;

  try {
    const result = await runDebugPreflight(
      debugRequestToServiceInput(parsed.data),
    );
    return ok(result);
  } catch (error) {
    return failFromError("Debug preflight", error);
  }
}

export async function GET() {
  return fail("Method not allowed", 405);
}
