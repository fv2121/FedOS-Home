import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { createTaskSchema, eventActorSchema } from "@/lib/validators";
import { createTask } from "@/lib/task-service";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ input: createTaskSchema, actor: eventActorSchema });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const task = await createTask(parsed.data.input, parsed.data.actor);
    return ok(task);
  } catch (error) {
    return fail("createTask failed", 500, String(error));
  }
}
