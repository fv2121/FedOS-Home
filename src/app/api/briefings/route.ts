import { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/http";
import { failFromError, requireAuth } from "@/lib/route-helpers";
import { listBriefingPackages } from "@/server/briefings";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return failFromError("listBriefingPackages", parsed.error);
  }

  try {
    const packages = await listBriefingPackages({ limit: parsed.data.limit });
    return ok(packages);
  } catch (error) {
    return failFromError("listBriefingPackages", error);
  }
}
