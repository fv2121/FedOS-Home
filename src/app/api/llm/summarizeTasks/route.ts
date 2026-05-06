import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { summarizeTasks } from "@/lib/task-service";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ scope: z.string().optional() });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const summary = await summarizeTasks(parsed.data.scope);
    return ok(summary);
  } catch (error) {
    return fail("summarizeTasks failed", 500, String(error));
  }
}
