import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAuth, requireJson } from "@/lib/route-helpers";
import { readDraft, saveDraft } from "@/server/memory";
import { failFromDigestError, saveDraftSchema } from "../_schema";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    const content = await readDraft();
    return ok({ content });
  } catch (error) {
    return failFromDigestError("Read digest draft", error);
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await requireJson(request, saveDraftSchema);
  if (parsed.error) return parsed.error;
  try {
    const status = await saveDraft({
      content: parsed.data.content,
      manuallyEdited: true,
    });
    return ok({ status });
  } catch (error) {
    return failFromDigestError("Save digest draft", error);
  }
}
