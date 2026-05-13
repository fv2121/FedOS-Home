import { NextRequest } from "next/server";
import { z } from "zod";
import { eventActorSchema, updateTaskCategorySchema } from "@/lib/validators";
import { updateTaskCategory } from "@/server/tasks";
import { ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";

const schema = updateTaskCategorySchema.and(z.object({ actor: eventActorSchema }));

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const result = await updateTaskCategory(
      parsed.data.taskId,
      parsed.data.categoryId,
      parsed.data.actor,
    );
    return ok(result);
  } catch (error) {
    return failFromError("updateTaskCategory", error);
  }
}
