import { z } from "zod";

export const debugRunRequestSchema = z.object({
  contextMode: z.string().min(1).max(64).optional(),
  model: z.string().min(1).max(128).optional(),
  maxTokens: z.number().int().positive().max(64_000).optional(),
  useFullMemory: z.boolean().optional(),
  persist: z.boolean().optional(),
  mailLookbackDays: z.number().int().min(0).max(30).optional(),
  mailMaxResults: z.number().int().min(0).max(500).optional(),
  calendarLookaheadDays: z.number().int().min(0).max(30).optional(),
  calendarMaxResults: z.number().int().min(0).max(500).optional(),
  includeBodyPreviews: z.boolean().optional(),
});

export type DebugRunRequest = z.infer<typeof debugRunRequestSchema>;

import type { DebugRunInput } from "@/server/debug";

export function debugRequestToServiceInput(req: DebugRunRequest): DebugRunInput {
  return {
    contextMode: req.contextMode,
    model: req.model,
    maxTokens: req.maxTokens,
    useFullMemory: req.useFullMemory,
    persist: req.persist,
    outlook: {
      mailLookbackDays: req.mailLookbackDays,
      mailMaxResults: req.mailMaxResults,
      calendarLookaheadDays: req.calendarLookaheadDays,
      calendarMaxResults: req.calendarMaxResults,
      includeBodyPreviews: req.includeBodyPreviews,
    },
  };
}
