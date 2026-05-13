import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireJson } from "@/lib/route-helpers";
import { approveDraft } from "@/server/memory";
import { approveSchema, failFromDigestError } from "../_schema";

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, approveSchema);
  if (parsed.error) return parsed.error;
  try {
    const status = await approveDraft();
    return ok({ status });
  } catch (error) {
    return failFromDigestError("Approve digest", error);
  }
}
