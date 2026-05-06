import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { taskFilterSchema } from "@/lib/validators";
import { searchTasks } from "@/lib/task-service";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ filters: taskFilterSchema.optional() });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const tasks = await searchTasks(parsed.data?.filters ?? {});
    return ok(tasks);
  } catch (error) {
    return fail("searchTasks failed", 500, String(error));
  }
}
