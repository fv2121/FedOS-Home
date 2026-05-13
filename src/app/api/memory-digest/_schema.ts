import { z } from "zod";
import { fail } from "@/lib/http";
import {
  DigestDraftMissingError,
  DigestRootNotConfiguredError,
} from "@/server/memory";

export const saveDraftSchema = z.object({
  content: z.string().max(200_000),
});

export const saveFeedbackSchema = z.object({
  content: z.string().max(50_000),
});

export const generateDraftSchema = z.object({
  model: z.string().min(1).max(128).optional(),
  maxTokens: z.number().int().min(256).max(16_000).optional(),
  useFeedback: z.boolean().optional(),
  usePreviousDraft: z.boolean().optional(),
});

export const approveSchema = z.object({
  confirm: z.literal(true),
});

export function failFromDigestError(operation: string, error: unknown) {
  if (error instanceof DigestRootNotConfiguredError) {
    return fail(error.message, 500);
  }
  if (error instanceof DigestDraftMissingError) {
    return fail(error.message, 404);
  }
  return fail(`${operation} failed`, 500, String(error));
}
