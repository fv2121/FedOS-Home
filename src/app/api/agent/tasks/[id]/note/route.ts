import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireAgentJson } from "@/lib/agent-route-helpers";
import { failFromError } from "@/lib/route-helpers";
import { addTaskNote } from "@/server/tasks";
import { addTaskNoteSchema } from "@/lib/validators";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = await requireAgentJson(request, addTaskNoteSchema);
  if (parsed.error) return parsed.error;

  const { id } = await ctx.params;

  try {
    const result = await addTaskNote(id, parsed.data.note, "llm");
    return ok(result);
  } catch (error) {
    return failFromError("addTaskNote", error);
  }
}
