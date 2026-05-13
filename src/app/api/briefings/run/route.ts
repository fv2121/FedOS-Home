import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { failFromError, requireJson } from "@/lib/route-helpers";
import { runBriefingGeneration } from "@/server/briefings";

const signalSchema = z.object({
  source_type: z.string(),
  source_id: z.string(),
  source_link: z.string().nullish(),
  title: z.string(),
  summary: z.string().nullish(),
  timestamp: z.union([z.string(), z.date()]).nullish(),
  participants: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const requestSchema = z.object({
  contextMode: z.string().optional(),
  signals: z.array(signalSchema),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  useFullMemory: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await requireJson(request, requestSchema);
  if (parsed.error) return parsed.error;

  try {
    const result = await runBriefingGeneration({
      contextMode: parsed.data.contextMode,
      signals: parsed.data.signals,
      model: parsed.data.model,
      maxTokens: parsed.data.maxTokens,
      useFullMemory: parsed.data.useFullMemory,
    });
    return ok({
      packageId: result.persisted?.packageId ?? null,
      proposedActionIds: result.persisted?.proposedActionIds ?? [],
      stats: result.stats,
      warnings: result.warnings,
      memoryDigest: result.memoryDigest,
      llm: result.llm,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
      return fail("LLM provider is not configured", 503, error.message);
    }
    if (error instanceof Error && error.message.includes("Anthropic SDK is not installed")) {
      return fail("LLM provider SDK is not installed", 503, error.message);
    }
    return failFromError("runBriefingGeneration", error);
  }
}
