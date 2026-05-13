import { estimateModelCost } from "@/server/llm/client";
import {
  formatMemoryForPrompt,
  type MemoryContext,
} from "./context";

/**
 * Memory Digest generation prompt + LLM call (HCI-08A).
 *
 * The digest LLM call produces plain Markdown (not structured tool output), so
 * it does not reuse the briefing client. The Anthropic SDK is loaded lazily.
 */

export const DIGEST_PROMPT_VERSION = "v1";
export const DEFAULT_DIGEST_MODEL = "claude-opus-4-6";
export const DEFAULT_DIGEST_MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are compressing Federico's FedOS Memory into a concise briefing-ready digest for his personal intelligence assistant.

Goal: produce a single Markdown document that gives the daily-briefing LLM enough stable judgment context without re-sending every Memory file in full each day.

OUTPUT EXPECTATIONS:
- Plain Markdown, no preamble, no apology, no commentary outside the digest.
- Preserve traceability: name the Memory files or sections you drew from, in a short "Sources" block.
- Cover, in priority order:
  1. Identity and operating frame the briefing LLM needs to act in character.
  2. Current priorities and active projects.
  3. Open loops and commitments worth remembering.
  4. Stakeholder context (VIPs, key relationships).
  5. Prioritization rubric (how Federico decides what matters).
  6. Preferences relevant to briefing tone and depth.
  7. Brief notes on operating principles, permissions, or decision/feedback patterns only if they materially affect daily judgment.
- Compress; do not paraphrase to the point of losing specificity.
- Call out important omissions, caveats, or areas you compressed heavily.

CONSTRAINTS:
- This digest is a candidate. Federico will review it; do not assume it ships unedited.
- Never invent facts not present in the supplied Memory.
- Do not write back-channel instructions to the model that will read this digest.
- If feedback notes are provided, treat them as authoritative guidance for this regeneration.`;

function buildUserMessage(args: {
  memory: MemoryContext;
  feedback?: string | null;
  previousDraft?: string | null;
}): string {
  const parts: string[] = [];
  if (args.feedback) {
    parts.push("=== FEEDBACK / CORRECTIONS FOR THIS REGENERATION ===");
    parts.push(args.feedback.trim());
    parts.push("");
  }
  if (args.previousDraft) {
    parts.push(
      "=== PREVIOUS DRAFT (for reference; supersede where feedback contradicts) ===",
    );
    parts.push(args.previousDraft.trim());
    parts.push("");
  }
  parts.push(formatMemoryForPrompt(args.memory));
  parts.push("");
  parts.push("Produce the digest now.");
  return parts.join("\n");
}

export type DigestUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  cost_approximate: boolean;
};

export type DigestGenerationResult = {
  digestMarkdown: string;
  usage: DigestUsage | null;
  promptVersion: string;
};

export type DigestLLMClient = {
  generate(args: {
    systemPrompt: string;
    userMessage: string;
    model: string;
    maxTokens: number;
  }): Promise<{
    rawText: string;
    inputTokens: number;
    outputTokens: number;
  }>;
};

type AnthropicMessageBlock = { type: string; text?: string };
type AnthropicMessageResponse = {
  content?: AnthropicMessageBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
};
type AnthropicLikeClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: "user"; content: string }>;
    }): Promise<AnthropicMessageResponse>;
  };
};

let cachedClient: AnthropicLikeClient | null = null;

async function getAnthropicClient(apiKey: string): Promise<AnthropicLikeClient> {
  if (cachedClient) return cachedClient;
  const moduleName = "@anthropic-ai/sdk";
  let mod: { default?: new (opts: { apiKey: string }) => AnthropicLikeClient };
  try {
    mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: new (opts: { apiKey: string }) => AnthropicLikeClient;
    };
  } catch (err) {
    throw new Error(
      `Anthropic SDK is not installed. Install '@anthropic-ai/sdk' to generate digest drafts. (${String(err)})`,
    );
  }
  const Ctor = mod.default;
  if (!Ctor) {
    throw new Error("Anthropic SDK loaded but no default export was found");
  }
  cachedClient = new Ctor({ apiKey });
  return cachedClient;
}

export const anthropicDigestClient: DigestLLMClient = {
  async generate(args) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    const client = await getAnthropicClient(apiKey);
    const response = await client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.systemPrompt,
      messages: [{ role: "user", content: args.userMessage }],
    });
    const blocks = response.content ?? [];
    const rawText = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!)
      .join("")
      .trim();
    return {
      rawText,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  },
};

export type GenerateDigestDraftInput = {
  memory: MemoryContext;
  feedback?: string | null;
  previousDraft?: string | null;
  model?: string;
  maxTokens?: number;
  client?: DigestLLMClient;
};

export async function generateMemoryDigestDraft(
  input: GenerateDigestDraftInput,
): Promise<DigestGenerationResult> {
  if (!input.memory.available) {
    throw new Error("FedOS Memory is not available; cannot generate digest");
  }
  const model = input.model ?? DEFAULT_DIGEST_MODEL;
  const maxTokens = input.maxTokens ?? DEFAULT_DIGEST_MAX_TOKENS;
  const client = input.client ?? anthropicDigestClient;

  const userMessage = buildUserMessage({
    memory: input.memory,
    feedback: input.feedback,
    previousDraft: input.previousDraft,
  });

  const response = await client.generate({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    model,
    maxTokens,
  });

  if (!response.rawText) {
    throw new Error("Digest generation returned empty content");
  }

  const usage: DigestUsage = {
    model,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    cost_usd: estimateModelCost(
      model,
      response.inputTokens,
      response.outputTokens,
    ),
    cost_approximate: true,
  };

  return {
    digestMarkdown: response.rawText,
    usage,
    promptVersion: DIGEST_PROMPT_VERSION,
  };
}
