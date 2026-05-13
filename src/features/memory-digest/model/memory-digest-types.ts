import type { DigestWorkflowStatus } from "@/server/memory";

export const DIGEST_MODEL_OPTIONS = [
  { label: "Opus", value: "claude-opus-4-6" },
  { label: "Sonnet", value: "claude-sonnet-4-6" },
  { label: "Haiku", value: "claude-haiku-4-5-20251001" },
] as const;

export type DigestModelValue = (typeof DIGEST_MODEL_OPTIONS)[number]["value"];

export const DEFAULT_DIGEST_MODEL_VALUE: DigestModelValue = "claude-opus-4-6";

export type DigestLLMUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  cost_approximate: boolean;
};

export type DigestLLMResult = {
  model: string;
  promptVersion: string;
  usage: DigestLLMUsage | null;
};

export type DigestGenerationOptions = {
  model: DigestModelValue;
  maxTokens: number;
  useFeedback: boolean;
  usePreviousDraft: boolean;
};

export const DEFAULT_GENERATION_OPTIONS: DigestGenerationOptions = {
  model: DEFAULT_DIGEST_MODEL_VALUE,
  maxTokens: 4096,
  useFeedback: true,
  usePreviousDraft: true,
};

export type DigestStatus = DigestWorkflowStatus;
