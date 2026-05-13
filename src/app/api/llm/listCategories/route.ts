import { NextRequest } from "next/server";
import { listCategories } from "@/server/tasks";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/route-helpers";

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    return ok(await listCategories());
  } catch (error) {
    return fail("listCategories failed", 500, String(error));
  }
}
