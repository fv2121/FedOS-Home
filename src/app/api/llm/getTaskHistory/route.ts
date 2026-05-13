import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getTaskHistory } from "@/server/tasks";
import { requireJson } from "@/lib/route-helpers";

const schema = z.object({ id: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, schema);
  if (parsed.error) return parsed.error;

  try {
    const history = await getTaskHistory(parsed.data.id);
    return ok(history);
  } catch (error) {
    return fail("getTaskHistory failed", 500, String(error));
  }
}
