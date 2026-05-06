import { NextRequest } from "next/server";
import { z } from "zod";
import { addTaskNoteSchema, eventActorSchema } from "@/lib/validators";
import { addTaskNote } from "@/lib/task-service";
import { fail, ok } from "@/lib/http";
import { requireJson } from "@/lib/route-helpers";

const schema = z
  .object({ id: z.string().min(1), actor: eventActorSchema })
  .and(addTaskNoteSchema);

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const result = await addTaskNote(parsed.data.id, parsed.data.note, parsed.data.actor);
    return ok(result);
  } catch (error) {
    return fail("addTaskNote failed", 500, String(error));
  }
}
