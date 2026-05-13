import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAuth } from "@/lib/route-helpers";
import { readApproved } from "@/server/memory";
import { failFromDigestError } from "../_schema";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    const content = await readApproved();
    return ok({ content });
  } catch (error) {
    return failFromDigestError("Read approved digest", error);
  }
}
