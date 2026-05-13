/**
 * Minimal LLM client wrapper for structured briefing JSON.
 *
 * We expose a small `BriefingLLMClient` interface so the briefing generation
 * orchestrator can inject any backend (real Anthropic, fake/mock, or a future
 * provider). The Anthropic implementation is lazy-loaded so the optional
 * `@anthropic-ai/sdk` dependency is not required to compile or run the
 * fixture/fake path used in smoke tests.
 */

export type LLMUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  cost_approximate: boolean;
};

export type BriefingLLMRequest = {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
};

export type BriefingLLMResponse = {
  rawText: string;
  usage: LLMUsage | null;
};

export type BriefingLLMClient = {
  generate(request: BriefingLLMRequest): Promise<BriefingLLMResponse>;
};

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const DEFAULT_MAX_TOKENS = 2048;

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

/**
 * Public helper to estimate the USD cost of a model invocation given input/output
 * token counts. Returns `null` if pricing is unknown for the model. Used by the
 * debug console preflight to surface a max-cost estimate before running.
 */
export function estimateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  return estimateCost(model, inputTokens, outputTokens);
}

type AnthropicMessageBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
};
type AnthropicMessageResponse = {
  content?: AnthropicMessageBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string | null;
};

type AnthropicLikeClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: "user"; content: string }>;
      tools?: Array<{
        name: string;
        description?: string;
        input_schema: Record<string, unknown>;
      }>;
      tool_choice?: { type: "tool"; name: string };
    }): Promise<AnthropicMessageResponse>;
  };
};

let cachedAnthropicClient: AnthropicLikeClient | null = null;

async function getAnthropicClient(apiKey: string): Promise<AnthropicLikeClient> {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  // The SDK is an optional runtime dependency. We avoid a static import so the
  // package is not required to compile. The variable indirection prevents the
  // bundler from trying to resolve the specifier at build time.
  const moduleName = "@anthropic-ai/sdk";
  let mod: { default?: new (opts: { apiKey: string }) => AnthropicLikeClient };
  try {
    mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: new (opts: { apiKey: string }) => AnthropicLikeClient;
    };
  } catch (err) {
    throw new Error(
      `Anthropic SDK is not installed. Install '@anthropic-ai/sdk' to use the real LLM client. (${String(err)})`,
    );
  }
  const Ctor = mod.default;
  if (!Ctor) {
    throw new Error("Anthropic SDK loaded but no default export was found");
  }
  cachedAnthropicClient = new Ctor({ apiKey });
  return cachedAnthropicClient;
}

/**
 * Real Anthropic-backed implementation of {@link BriefingLLMClient}. Requires
 * `ANTHROPIC_API_KEY` and the `@anthropic-ai/sdk` package to be installed.
 */
export const anthropicBriefingClient: BriefingLLMClient = {
  async generate(request) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    const model = request.model ?? DEFAULT_MODEL;
    const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
    const client = await getAnthropicClient(apiKey);
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
      tools: [
        {
          name: "emit_briefing",
          description: "Emit the structured morning briefing package.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              narrative: { type: "string" },
              top_priorities: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    rank: { type: "integer" },
                    title: { type: "string" },
                    why: { type: "string" },
                    signal_id: { type: ["string", "null"] },
                  },
                  required: ["rank", "title", "why"],
                },
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              proposed_actions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    action: { type: "string" },
                    context: { type: "string" },
                    signal_id: { type: ["string", "null"] },
                  },
                  required: ["action", "context"],
                },
              },
              uncertainty: { type: ["string", "null"] },
            },
            required: [
              "narrative",
              "top_priorities",
              "recommendations",
              "proposed_actions",
              "uncertainty",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_briefing" },
    });
    const blocks = response.content ?? [];
    const toolBlock = blocks.find(
      (b) => b.type === "tool_use" && b.name === "emit_briefing",
    );
    const rawText =
      toolBlock?.input !== undefined
        ? JSON.stringify(toolBlock.input)
        : blocks
            .filter((b) => b.type === "text" && typeof b.text === "string")
            .map((b) => b.text!)
            .join("");
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const usage: LLMUsage = {
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(model, inputTokens, outputTokens),
      cost_approximate: true,
    };
    return { rawText, usage };
  },
};
