import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAuth } from "@/lib/route-helpers";
import { getDigestStatus } from "@/server/memory";
import { failFromDigestError } from "../_schema";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    const status = await getDigestStatus();
    return ok(status);
  } catch (error) {
    return failFromDigestError("Get digest status", error);
  }
}
