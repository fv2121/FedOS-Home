import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getTask } from "@/lib/task-service";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ id: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  const task = await getTask(parsed.data.id);
  if (!task) return fail("Task not found", 404);
  return ok(task);
}
