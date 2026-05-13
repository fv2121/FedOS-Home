/**
 * Smoke check for HCI-04: drive `generateBriefingPackage` with a small
 * fixture signal pack and a fake LLM client. Defaults to dry-run so it does
 * not require a database. Pass `--persist` to write to the DB (requires the
 * HCI-01 migration to be applied locally).
 */
import { loadEnvConfig } from "@next/env";
import {
  generateBriefingPackage,
  type LLMFirstInsights,
} from "@/server/intelligence";
import type { BriefingLLMClient } from "@/server/llm/client";
import type { BriefingSignal } from "@/server/sources/llm-first-signals";

loadEnvConfig(process.cwd());

const fixtureSignals: BriefingSignal[] = [
  {
    source_type: "outlook_mail",
    source_id: "mail-1",
    title: "Q3 board pre-read draft",
    timestamp: "2026-05-12T07:30:00Z",
    metadata: {
      sender_name: "Maria Rossi",
      sender_email: "maria@example.com",
      to_recipients: ["federico@example.com"],
      is_read: false,
      body_preview: "Sharing the v2 draft. Need your edits by Wednesday.",
      conversation_id: "conv-board",
    },
  },
  {
    source_type: "outlook_mail",
    source_id: "mail-2",
    title: "Re: Q3 board pre-read draft",
    timestamp: "2026-05-12T08:10:00Z",
    metadata: {
      sender_name: "Maria Rossi",
      sender_email: "maria@example.com",
      to_recipients: ["federico@example.com"],
      is_read: false,
      body_preview: "Bumping this — let me know if section 3 lands.",
      conversation_id: "conv-board",
    },
  },
  {
    source_type: "outlook_mail",
    source_id: "mail-noise",
    title: "Out of office: Acme Corp",
    timestamp: "2026-05-12T06:00:00Z",
    metadata: {
      sender_name: "Acme Auto",
      sender_email: "no-reply@acme.example.com",
      to_recipients: ["federico@example.com"],
      is_read: false,
    },
  },
  {
    source_type: "outlook_calendar",
    source_id: "cal-1",
    title: "EMEA growth review",
    summary: "30 min, weekly cadence",
    timestamp: "2026-05-12T09:00:00Z",
    participants: ["maria@example.com", "luca@example.com"],
    metadata: {
      organizer_email: "luca@example.com",
      event_start: "2026-05-12T09:00:00Z",
      event_end: "2026-05-12T09:30:00Z",
    },
  },
];

const fakeInsights: LLMFirstInsights = {
  narrative:
    "Maria has nudged twice on the Q3 board pre-read; the EMEA growth review at 09:00 is the day's only synchronous touchpoint.",
  top_priorities: [
    {
      rank: 1,
      title: "Land Q3 board pre-read edits",
      why: "Maria followed up within the same thread before 08:15 and is blocked on you.",
      signal_id: "mail-1",
    },
    {
      rank: 2,
      title: "Prep for EMEA growth review",
      why: "It is the only meeting today and Luca organizes it.",
      signal_id: "cal-1",
    },
  ],
  recommendations: [
    "Send Maria a short ETA reply before lunch.",
    "Block 30 minutes pre-meeting to skim the EMEA dashboard.",
  ],
  proposed_actions: [
    { action: "Reply to Maria with ETA on board pre-read", context: "Two-message nudge in conv-board.", signal_id: "mail-1" },
    { action: "Skim EMEA dashboard before 09:00", context: "Pre-read for the growth review.", signal_id: "cal-1" },
  ],
  uncertainty: "Unclear if section 3 already incorporates the pricing change discussed last week.",
};

const fakeLLMClient: BriefingLLMClient = {
  async generate() {
    return {
      rawText: JSON.stringify(fakeInsights),
      usage: {
        model: "fake",
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        cost_approximate: true,
      },
    };
  },
};

async function main() {
  const persist = process.argv.includes("--persist");
  const result = await generateBriefingPackage({
    signals: fixtureSignals,
    llmClient: fakeLLMClient,
    dryRun: !persist,
  });

  console.log(
    JSON.stringify(
      {
        stats: result.stats,
        warnings: result.warnings,
        memoryDigest: result.memoryDigest,
        llm: result.llm,
        insightsPreview: {
          narrative: result.insights.narrative,
          topPriorities: result.insights.top_priorities.length,
          recommendations: result.insights.recommendations.length,
          proposedActions: result.insights.proposed_actions.length,
        },
        promptBlockSizes: {
          stableContext: result.promptBlocks.stableContext.length,
          dynamicSignals: result.promptBlocks.dynamicSignals.length,
          userMessage: result.userMessage.length,
        },
        persisted: result.persisted,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
