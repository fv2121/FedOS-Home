import type {
  DebugPreflightResult,
  DebugRunInput,
  DebugRunResult,
} from "@/server/debug";

export const DEBUG_MODEL_OPTIONS = [
  { label: "Opus", value: "claude-opus-4-6" },
  { label: "Sonnet", value: "claude-sonnet-4-6" },
  { label: "Haiku", value: "claude-haiku-4-5-20251001" },
] as const;

export type DebugModelValue = (typeof DEBUG_MODEL_OPTIONS)[number]["value"];

export const DEFAULT_DEBUG_MODEL: DebugModelValue = "claude-sonnet-4-6";

export type DebugConsoleInput = {
  contextMode: string;
  model: string;
  maxTokens: number;
  useFullMemory: boolean;
  persist: boolean;
  mailLookbackDays: number;
  mailMaxResults: number;
  calendarLookaheadDays: number;
  calendarMaxResults: number;
  includeBodyPreviews: boolean;
};

export const DEFAULT_DEBUG_INPUT: DebugConsoleInput = {
  contextMode: "business",
  model: DEFAULT_DEBUG_MODEL,
  maxTokens: 4096,
  useFullMemory: false,
  persist: false,
  mailLookbackDays: 1,
  mailMaxResults: 50,
  calendarLookaheadDays: 1,
  calendarMaxResults: 50,
  includeBodyPreviews: true,
};

export function debugInputToRequest(
  input: DebugConsoleInput,
): Omit<DebugRunInput, "outlook"> & {
  mailLookbackDays?: number;
  mailMaxResults?: number;
  calendarLookaheadDays?: number;
  calendarMaxResults?: number;
  includeBodyPreviews?: boolean;
} {
  return {
    contextMode: input.contextMode || undefined,
    model: input.model || undefined,
    maxTokens: input.maxTokens,
    useFullMemory: input.useFullMemory,
    persist: input.persist,
    mailLookbackDays: input.mailLookbackDays,
    mailMaxResults: input.mailMaxResults,
    calendarLookaheadDays: input.calendarLookaheadDays,
    calendarMaxResults: input.calendarMaxResults,
    includeBodyPreviews: input.includeBodyPreviews,
  };
}

export type DebugResult = DebugPreflightResult | DebugRunResult;
export type { DebugPreflightResult, DebugRunResult };
