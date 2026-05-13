import { NextRequest } from "next/server";
import { z } from "zod";
import { ok } from "@/lib/http";
import { eventActorSchema, updateTaskSchema } from "@/lib/validators";
import { failFromError, requireJson } from "@/lib/route-helpers";
import { updateTask } from "@/server/tasks";

const schema = z.object({
  id: z.string().min(1),
  fields: updateTaskSchema,
  reason: z.string().optional(),
  actor: eventActorSchema,
});

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const task = await updateTask(
      parsed.data.id,
      parsed.data.fields,
      parsed.data.actor,
      parsed.data.reason,
    );
    return ok(task);
  } catch (error) {
    return failFromError("updateTask", error);
  }
}
