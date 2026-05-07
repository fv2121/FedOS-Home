import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", service: "fedos-tasks", db: "connected" });
  } catch {
    return fail("Database unavailable", 503);
  }
}
