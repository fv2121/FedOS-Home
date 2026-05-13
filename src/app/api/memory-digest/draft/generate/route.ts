import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { requireAuth, requireJson } from "@/lib/route-helpers";
import {
  DEFAULT_DIGEST_MAX_TOKENS,
  DEFAULT_DIGEST_MODEL,
  generateMemoryDigestDraft,
  loadMemoryContext,
  readDraft,
  readFeedback,
  saveDraft,
} from "@/server/memory";
import { failFromDigestError, generateDraftSchema } from "../../_schema";

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, generateDraftSchema);
  if (parsed.error) return parsed.error;

  const authError = requireAuth(request);
  if (authError) return authError;

  const model = parsed.data.model ?? DEFAULT_DIGEST_MODEL;
  const maxTokens = parsed.data.maxTokens ?? DEFAULT_DIGEST_MAX_TOKENS;
  const useFeedback = parsed.data.useFeedback ?? true;
  const usePreviousDraft = parsed.data.usePreviousDraft ?? true;

  const memory = await loadMemoryContext();
  if (!memory.available) {
    return fail("FedOS Memory is not available; cannot generate digest", 400, {
      error: memory.error,
    });
  }

  try {
    const [feedback, previousDraft] = await Promise.all([
      useFeedback ? readFeedback() : Promise.resolve(null),
      usePreviousDraft ? readDraft() : Promise.resolve(null),
    ]);

    const generation = await generateMemoryDigestDraft({
      memory,
      feedback,
      previousDraft,
      model,
      maxTokens,
    });

    const status = await saveDraft(
      {
        content: generation.digestMarkdown,
        manuallyEdited: false,
        model,
      },
      { memory },
    );

    return ok({
      status,
      draft: generation.digestMarkdown,
      llm: {
        model,
        promptVersion: generation.promptVersion,
        usage: generation.usage,
      },
    });
  } catch (error) {
    return failFromDigestError("Generate digest draft", error);
  }
}
