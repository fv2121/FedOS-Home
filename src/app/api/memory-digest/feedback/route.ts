import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAuth, requireJson } from "@/lib/route-helpers";
import { readFeedback, saveFeedback } from "@/server/memory";
import { failFromDigestError, saveFeedbackSchema } from "../_schema";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    const content = await readFeedback();
    return ok({ content });
  } catch (error) {
    return failFromDigestError("Read digest feedback", error);
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await requireJson(request, saveFeedbackSchema);
  if (parsed.error) return parsed.error;
  try {
    const status = await saveFeedback(parsed.data.content);
    return ok({ status });
  } catch (error) {
    return failFromDigestError("Save digest feedback", error);
  }
}
