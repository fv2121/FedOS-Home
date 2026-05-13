import {
  fetchOutlookSignalPack,
  type FetchOutlookSignalPackInput,
  type FetchOutlookSignalPackResult,
  type OutlookTokenStatus,
} from "@/server/sources/outlook";
import {
  generateBriefingPackage,
  prepareBriefingForLLM,
  type GenerateBriefingInput,
  type GeneratedBriefingPackage,
  type GenerationStats,
  type LLMFirstInsights,
  type PreparedBriefing,
  type PromptBlocks,
} from "@/server/intelligence";
import type { CompactedBriefingSignal } from "@/server/sources/llm-first-signals";
import { estimateModelCost } from "@/server/llm/client";
import { estimateTokens, redactSignal, type RedactedSignal } from "./redact";

/**
 * Backend orchestration for the HCI-08 Debug Console.
 *
 * Two flows:
 * - `runDebugPreflight`: fetch + prepare without touching the LLM or DB.
 * - `runDebugBriefing`: full pipeline; `persist` toggles HCI-04 dryRun.
 *
 * Outputs are shaped for the debug UI: counts, redacted signal samples,
 * prompt previews, token estimates, and a tightly-scoped raw JSON payload.
 */

const SIGNAL_SAMPLE_LIMIT = 25;

export type DebugRunInput = {
  contextMode?: string;
  model?: string;
  maxTokens?: number;
  useFullMemory?: boolean;
  persist?: boolean;
  outlook?: FetchOutlookSignalPackInput;
};

export type DebugPipelineSummary = {
  contextMode: string;
  model: string;
  maxTokens: number;
  outlook: {
    tokenStatus: OutlookTokenStatus;
    rawCounts: { mail: number; calendar: number };
    warnings: string[];
  };
  stats: GenerationStats;
  prompt: {
    systemChars: number;
    stableChars: number;
    dynamicChars: number;
    userMessageChars: number;
    estimatedInputTokens: number;
    estimatedCostUsd: number | null;
    estimatedCostAssumesMaxOutput: boolean;
    blocks: PromptBlocks;
  };
  memoryDigest: {
    available: boolean;
    used: "digest" | "full" | "none";
    stale: boolean;
    approvedHash: string | null;
    approvedAt: string | null;
    sourceHash: string;
  };
  warnings: string[];
  signalSample: RedactedSignal[];
};

export type DebugPreflightResult = DebugPipelineSummary & {
  kind: "preflight";
};

export type DebugRunResult = DebugPipelineSummary & {
  kind: "run";
  insights: LLMFirstInsights;
  llm: {
    model: string;
    promptVersion: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cost_usd: number | null;
      cost_approximate: boolean;
    } | null;
  };
  persist: boolean;
  persisted: {
    packageId: string;
    proposedActionIds: string[];
  } | null;
};

type SummaryParts = {
  contextMode: string;
  model: string;
  maxTokens: number;
  signals: CompactedBriefingSignal[];
  stats: GenerationStats;
  warnings: string[];
  promptBlocks: PromptBlocks;
  userMessage: string;
  memoryDigest: PreparedBriefing["memoryDigest"];
};

function buildPipelineSummary(args: {
  outlook: FetchOutlookSignalPackResult;
  prepared: SummaryParts;
}): DebugPipelineSummary {
  const { outlook, prepared } = args;
  const systemChars = prepared.promptBlocks.staticInstructions.length;
  const stableChars = prepared.promptBlocks.stableContext.length;
  const dynamicChars = prepared.promptBlocks.dynamicSignals.length;
  const userMessageChars = prepared.userMessage.length;
  const estimatedInputTokens = estimateTokens(
    prepared.promptBlocks.staticInstructions + prepared.userMessage,
  );
  const estimatedCostUsd = estimateModelCost(
    prepared.model,
    estimatedInputTokens,
    prepared.maxTokens,
  );

  return {
    contextMode: prepared.contextMode,
    model: prepared.model,
    maxTokens: prepared.maxTokens,
    outlook: {
      tokenStatus: outlook.tokenStatus,
      rawCounts: outlook.rawCounts,
      warnings: outlook.warnings,
    },
    stats: prepared.stats,
    prompt: {
      systemChars,
      stableChars,
      dynamicChars,
      userMessageChars,
      estimatedInputTokens,
      estimatedCostUsd,
      estimatedCostAssumesMaxOutput: true,
      blocks: prepared.promptBlocks,
    },
    memoryDigest: prepared.memoryDigest,
    warnings: prepared.warnings,
    signalSample: prepared.signals
      .slice(0, SIGNAL_SAMPLE_LIMIT)
      .map(redactSignal),
  };
}

export async function runDebugPreflight(
  input: DebugRunInput,
): Promise<DebugPreflightResult> {
  const outlook = await fetchOutlookSignalPack(input.outlook ?? {});
  const prepared = await prepareBriefingForLLM({
    contextMode: input.contextMode,
    signals: outlook.signals,
    model: input.model,
    maxTokens: input.maxTokens,
    useFullMemory: input.useFullMemory,
  });

  return { kind: "preflight", ...buildPipelineSummary({ outlook, prepared }) };
}

export async function runDebugBriefing(
  input: DebugRunInput,
): Promise<DebugRunResult> {
  const outlook = await fetchOutlookSignalPack(input.outlook ?? {});

  const generationInput: GenerateBriefingInput = {
    contextMode: input.contextMode,
    signals: outlook.signals,
    model: input.model,
    maxTokens: input.maxTokens,
    useFullMemory: input.useFullMemory,
    dryRun: !input.persist,
  };

  const generated: GeneratedBriefingPackage =
    await generateBriefingPackage(generationInput);

  const summary = buildPipelineSummary({
    outlook,
    prepared: {
      contextMode: generated.contextMode,
      model: generated.llm.model,
      maxTokens: input.maxTokens ?? 0,
      signals: generated.signals,
      stats: generated.stats,
      warnings: generated.warnings,
      promptBlocks: generated.promptBlocks,
      userMessage: generated.userMessage,
      memoryDigest: generated.memoryDigest,
    },
  });

  return {
    kind: "run",
    ...summary,
    insights: generated.insights,
    llm: {
      model: generated.llm.model,
      promptVersion: generated.llm.promptVersion,
      usage: generated.llm.usage
        ? {
            input_tokens: generated.llm.usage.input_tokens,
            output_tokens: generated.llm.usage.output_tokens,
            cost_usd: generated.llm.usage.cost_usd,
            cost_approximate: generated.llm.usage.cost_approximate,
          }
        : null,
    },
    persist: Boolean(input.persist),
    persisted: generated.persisted
      ? {
          packageId: generated.persisted.packageId,
          proposedActionIds: generated.persisted.proposedActionIds,
        }
      : null,
  };
}

