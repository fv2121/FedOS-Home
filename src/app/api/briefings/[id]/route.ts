import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { failFromError, requireAuth } from "@/lib/route-helpers";
import { getBriefingPackage } from "@/server/briefings";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  try {
    const pkg = await getBriefingPackage(id);
    if (!pkg) return fail("Briefing package not found", 404);
    return ok(pkg);
  } catch (error) {
    return failFromError("getBriefingPackage", error);
  }
}
