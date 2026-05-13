import { NextRequest } from "next/server";
import { z } from "zod";
import { completeTaskSchema, eventActorSchema } from "@/lib/validators";
import { completeTask } from "@/server/tasks";
import { ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";

const schema = z.object({ id: z.string().min(1) }).and(completeTaskSchema).and(z.object({ actor: eventActorSchema }));

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const task = await completeTask(parsed.data.id, parsed.data.reason, parsed.data.actor);
    return ok(task);
  } catch (error) {
    return failFromError("completeTask", error);
  }
}
