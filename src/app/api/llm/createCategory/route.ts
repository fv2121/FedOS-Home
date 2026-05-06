import { NextRequest } from "next/server";
import { z } from "zod";
import { createCategorySchema } from "@/lib/validators";
import { createCategory } from "@/lib/task-service";
import { fail, ok } from "@/lib/http";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ input: createCategorySchema });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    return ok(await createCategory(parsed.data.input));
  } catch (error) {
    return fail("createCategory failed", 500, String(error));
  }
}
