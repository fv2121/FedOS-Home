import { z } from "zod";
import {
  formatSignalPack,
  type CompactedBriefingSignal,
} from "@/server/sources/llm-first-signals";

/**
 * System prompt and structured output contract for the LLM-first morning brief.
 *
 * Ported from FedOS Intelligence (`app/prompts/llm_first_brief.py`). The
 * shape is the MVP contract documented in HCI-01:
 *   { narrative, top_priorities, recommendations, proposed_actions, uncertainty }
 */

export const PROMPT_VERSION = "llm-first/v1";

export const SYSTEM_PROMPT = `You are a personal intelligence assistant for a senior operator who manages high inbound volume.

You will receive a cleaned pack of email and calendar signals, plus optional context from \
FedOS Memory (the operator's personal knowledge base). Your job is to reason over these signals \
and produce a structured morning briefing.

IMPORTANT CONSTRAINTS:
- You are reasoning over signals that have already been cleaned of obvious machine noise \
(no-reply, auto-replies, delivery failures). The full remaining set is given to you — \
do not assume anything was pre-ranked or pre-selected.
- FedOS Memory context is read-only. Use it to understand priorities, stakeholders, \
commitments, and judgment frames — but do not invent memory that is not there.
- Proposed actions are SUGGESTIONS ONLY. They are not canonical tasks. \
The operator will approve, reject, or edit them later.
- Be honest about uncertainty. If signals are thin or ambiguous, say so.

OUTPUT STRUCTURE:
- narrative: 2-4 sentence briefing as if a smart colleague is catching you up
- top_priorities: ranked list (rank 1 = most urgent/important), each with a clear "why"
- recommendations: 3-5 specific, actionable recommendations grounded in actual signals
- proposed_actions: concrete next-step suggestions for the operator to review
- uncertainty: anything the LLM is unsure about, or signals that are ambiguous

Respond with valid JSON matching the output schema exactly. Do not wrap the JSON in code fences \
or commentary.`;

export const TopPrioritySchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  why: z.string(),
  signal_id: z.string().nullish(),
});

export const ProposedActionSchema = z.object({
  action: z.string(),
  context: z.string(),
  signal_id: z.string().nullish(),
});

export const LLMFirstInsightsSchema = z.object({
  narrative: z.string(),
  top_priorities: z.array(TopPrioritySchema).default([]),
  recommendations: z.array(z.string()).default([]),
  proposed_actions: z.array(ProposedActionSchema).default([]),
  uncertainty: z.string().nullish(),
});

export type LLMFirstInsights = z.infer<typeof LLMFirstInsightsSchema>;
export type LLMFirstProposedAction = z.infer<typeof ProposedActionSchema>;

export type PromptBlocks = {
  staticInstructions: string;
  stableContext: string;
  dynamicSignals: string;
};

type JsonObject = Record<string, unknown>;
type NormalizedProposedAction = {
  action: string;
  context: string;
  signal_id: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(value: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function stringifyLoose(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (isObject(value)) {
    return (
      firstString(value, [
        "text",
        "recommendation",
        "description",
        "title",
        "action",
        "why",
        "summary",
      ]) ?? null
    );
  }
  return null;
}

function normalizeRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(stringifyLoose)
    .filter((item): item is string => Boolean(item));
}

function normalizeProposedActions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        return { action: item.trim(), context: "", signal_id: null };
      }
      if (!isObject(item)) return null;

      const action =
        firstString(item, ["action", "title", "task", "next_step"]) ??
        firstString(item, ["description"]);
      if (!action) return null;

      const context =
        firstString(item, ["context", "rationale", "why", "summary"]) ??
        (item.description !== action ? firstString(item, ["description"]) : "") ??
        "";

      const signalId =
        firstString(item, ["signal_id", "source_signal_id"]) ??
        (Array.isArray(item.source_signal_ids) &&
        typeof item.source_signal_ids[0] === "string"
          ? item.source_signal_ids[0]
          : null);

      return { action, context, signal_id: signalId };
    })
    .filter((item): item is NormalizedProposedAction => Boolean(item));
}

function normalizeUncertainty(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value
      .map(stringifyLoose)
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return stringifyLoose(value);
}

function normalizeInsightsShape(value: unknown): unknown {
  if (!isObject(value)) return value;
  return {
    ...value,
    recommendations: normalizeRecommendations(value.recommendations),
    proposed_actions: normalizeProposedActions(value.proposed_actions),
    uncertainty: normalizeUncertainty(value.uncertainty),
  };
}

export function buildPromptBlocks(input: {
  signals: CompactedBriefingSignal[];
  memoryText?: string;
}): PromptBlocks {
  const stableParts: string[] = [];
  if (input.memoryText && input.memoryText.length > 0) {
    stableParts.push(input.memoryText);
    stableParts.push("");
  }
  return {
    staticInstructions: SYSTEM_PROMPT,
    stableContext: stableParts.join("\n"),
    dynamicSignals: formatSignalPack(input.signals),
  };
}

export function buildUserMessage(blocks: PromptBlocks): string {
  if (blocks.stableContext) {
    return `${blocks.stableContext}\n${blocks.dynamicSignals}`;
  }
  return blocks.dynamicSignals;
}

/**
 * Strip optional ```json fences and parse the first JSON object found in the
 * response. Returns the parsed object validated against
 * {@link LLMFirstInsightsSchema}.
 */
export function parseInsightsResponse(rawText: string): LLMFirstInsights {
  const trimmed = rawText.trim();
  let candidate = trimmed;
  if (candidate.startsWith("```")) {
    candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("LLM response did not contain a JSON object");
  }
  const json = candidate.slice(start, end + 1);
  const parsed: unknown = JSON.parse(json);
  return LLMFirstInsightsSchema.parse(normalizeInsightsShape(parsed));
}
