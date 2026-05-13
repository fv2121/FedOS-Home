import { persistBriefingPackage, type PersistedBriefing } from "@/server/briefings";
import {
  anthropicBriefingClient,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  type BriefingLLMClient,
  type LLMUsage,
} from "@/server/llm/client";
import {
  formatApprovedMemoryDigestForPrompt,
  formatMemoryForPrompt,
  loadApprovedMemoryDigest,
  loadMemoryContext,
  type ApprovedMemoryDigest,
  type MemoryContext,
} from "@/server/memory";
import {
  buildPromptBlocks,
  buildUserMessage,
  parseInsightsResponse,
  PROMPT_VERSION,
  type LLMFirstInsights,
  type PromptBlocks,
} from "@/server/intelligence/prompt";
import {
  applyHygieneFilters,
  compactSignals,
  deduplicateSignals,
  type BriefingSignal,
  type CompactedBriefingSignal,
  type HygieneOptions,
} from "@/server/sources/llm-first-signals";

/**
 * Orchestrates briefing generation:
 *
 *  1. Apply hygiene filters.
 *  2. Deduplicate signals.
 *  3. Compact repeated mail/calendar groups.
 *  4. Load approved Memory Digest (preferred) or full Memory context.
 *  5. Build cache-ready prompt blocks.
 *  6. Call the LLM for the structured briefing JSON.
 *  7. Validate the LLM output.
 *  8. Persist BriefingPackage + ProposedAction rows.
 *
 * Network and DB dependencies are injectable so unit/smoke tests can drive
 * the orchestration with fakes.
 */

export type GenerateBriefingInput = {
  contextMode?: string;
  signals: BriefingSignal[];
  model?: string;
  maxTokens?: number;
  /** When true, use the full Memory context instead of the approved digest. */
  useFullMemory?: boolean;
  hygiene?: HygieneOptions;
  /** Override the LLM client (used by tests/smoke). */
  llmClient?: BriefingLLMClient;
  /** Override Memory Digest loading (used by tests/smoke). */
  loadMemory?: () => Promise<MemoryContext>;
  loadDigest?: (memory: MemoryContext) => Promise<ApprovedMemoryDigest>;
  /** When true, skip database persistence and only return the would-be payload. */
  dryRun?: boolean;
};

export type GenerationStats = {
  inputCount: number;
  hygieneExcluded: number;
  duplicates: number;
  collapsed: number;
  groups: number;
  finalCount: number;
};

export type GeneratedBriefingPackage = {
  contextMode: string;
  insights: LLMFirstInsights;
  promptBlocks: PromptBlocks;
  userMessage: string;
  signals: CompactedBriefingSignal[];
  stats: GenerationStats;
  warnings: string[];
  memoryDigest: {
    available: boolean;
    used: "digest" | "full" | "none";
    stale: boolean;
    approvedHash: string | null;
    approvedAt: string | null;
    sourceHash: string;
  };
  llm: {
    model: string;
    usage: LLMUsage | null;
    promptVersion: string;
  };
  persisted: PersistedBriefing | null;
};

export type PreparedBriefing = {
  contextMode: string;
  model: string;
  maxTokens: number;
  signals: CompactedBriefingSignal[];
  stats: GenerationStats;
  warnings: string[];
  promptBlocks: PromptBlocks;
  userMessage: string;
  memoryDigest: GeneratedBriefingPackage["memoryDigest"];
  digest: ApprovedMemoryDigest;
};

/**
 * Run steps 1-5 of the briefing pipeline (hygiene, dedup, compaction, memory
 * digest selection, prompt assembly) without calling the LLM or touching the
 * database. Used by both `generateBriefingPackage` and the HCI-08 debug
 * preflight route so they observe identical pipeline behavior.
 */
export async function prepareBriefingForLLM(
  input: Omit<GenerateBriefingInput, "llmClient" | "dryRun">,
): Promise<PreparedBriefing> {
  const warnings: string[] = [];
  const contextMode = input.contextMode ?? "business";
  const model = input.model ?? DEFAULT_MODEL;
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;

  const inputCount = input.signals.length;
  const { kept, excluded: hygieneExcluded } = applyHygieneFilters(
    input.signals,
    input.hygiene,
  );
  const { deduped, duplicates } = deduplicateSignals(kept);
  if (duplicates > 0) {
    warnings.push(`Deduplication removed ${duplicates} duplicate signal(s).`);
  }
  const { compacted, collapsed, groups } = compactSignals(deduped);

  const stats: GenerationStats = {
    inputCount,
    hygieneExcluded,
    duplicates,
    collapsed,
    groups,
    finalCount: compacted.length,
  };

  const memory = input.loadMemory
    ? await input.loadMemory()
    : await loadMemoryContext();
  if (!memory.available && memory.error) {
    warnings.push(`FedOS Memory unavailable: ${memory.error}`);
  }
  const digest = input.loadDigest
    ? await input.loadDigest(memory)
    : await loadApprovedMemoryDigest({ memory });

  const useFullMemory = input.useFullMemory ?? false;
  let memoryText = "";
  let memoryUsed: GeneratedBriefingPackage["memoryDigest"]["used"] = "none";
  if (!useFullMemory && digest.available && digest.content) {
    memoryText = formatApprovedMemoryDigestForPrompt(digest.content, {
      stale: digest.stale,
    });
    memoryUsed = "digest";
    if (digest.stale) {
      warnings.push(
        "Approved Memory digest is stale (FedOS Memory has changed since approval).",
      );
    }
  } else if (memory.available) {
    memoryText = formatMemoryForPrompt(memory);
    memoryUsed = "full";
  }
  for (const w of digest.warnings) {
    if (!warnings.includes(w)) warnings.push(w);
  }

  const promptBlocks = buildPromptBlocks({ signals: compacted, memoryText });
  const userMessage = buildUserMessage(promptBlocks);

  return {
    contextMode,
    model,
    maxTokens,
    signals: compacted,
    stats,
    warnings,
    promptBlocks,
    userMessage,
    memoryDigest: {
      available: digest.available,
      used: memoryUsed,
      stale: digest.stale,
      approvedHash: digest.approvedHash,
      approvedAt: digest.approvedAt,
      sourceHash: digest.sourceHash,
    },
    digest,
  };
}

export async function generateBriefingPackage(
  input: GenerateBriefingInput,
): Promise<GeneratedBriefingPackage> {
  const prepared = await prepareBriefingForLLM(input);
  const llmClient = input.llmClient ?? anthropicBriefingClient;

  const llmResponse = await llmClient.generate({
    systemPrompt: prepared.promptBlocks.staticInstructions,
    userMessage: prepared.userMessage,
    model: prepared.model,
    maxTokens: prepared.maxTokens,
  });

  const insights = parseInsightsResponse(llmResponse.rawText);

  let persisted: PersistedBriefing | null = null;
  if (!input.dryRun) {
    persisted = await persistBriefingPackage({
      contextMode: prepared.contextMode,
      insights,
      signals: prepared.signals,
      model: prepared.model,
      promptVersion: PROMPT_VERSION,
      memoryDigestHash: prepared.digest.approvedHash,
      memoryDigestStale: prepared.digest.available ? prepared.digest.stale : null,
      memoryDigestApprovedAt: prepared.digest.approvedAt
        ? new Date(prepared.digest.approvedAt)
        : null,
    });
  }

  return {
    contextMode: prepared.contextMode,
    insights,
    promptBlocks: prepared.promptBlocks,
    userMessage: prepared.userMessage,
    signals: prepared.signals,
    stats: prepared.stats,
    warnings: prepared.warnings,
    memoryDigest: prepared.memoryDigest,
    llm: {
      model: prepared.model,
      usage: llmResponse.usage,
      promptVersion: PROMPT_VERSION,
    },
    persisted,
  };
}
