import { NextRequest } from "next/server";
import { z } from "zod";
import { deleteTask } from "@/lib/task-service";
import { fail, ok } from "@/lib/http";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ id: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const result = await deleteTask(parsed.data.id);
    return ok(result);
  } catch (error) {
    return fail("deleteTask failed", 500, String(error));
  }
}
