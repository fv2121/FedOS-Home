/**
 * Smoke check for HCI-07 Outlook ingestion.
 *
 * Usage:
 *   npx tsx scripts/smoke-outlook-signals.ts
 *   npx tsx scripts/smoke-outlook-signals.ts --feed
 *
 * Reads Home env config, fetches a small Outlook mail/calendar window via
 * Microsoft Graph, prints redacted counts/samples, and exits with a clear
 * message if token configuration is missing.
 *
 * Never logs access/refresh tokens, full bodies, or full email addresses.
 *
 * `--feed` additionally pipes the resulting signals into the HCI-04
 * generation pipeline with a fake LLM so we can verify the signal shape
 * without paying for provider calls.
 */
import { loadEnvConfig } from "@next/env";
import { fetchOutlookSignalPack } from "@/server/sources/outlook";
import type { BriefingSignal } from "@/server/sources/llm-first-signals";
import {
  generateBriefingPackage,
  type LLMFirstInsights,
} from "@/server/intelligence";
import type { BriefingLLMClient } from "@/server/llm/client";

loadEnvConfig(process.cwd());

function redactEmail(value: string | undefined | null): string {
  if (!value) return "";
  const idx = value.indexOf("@");
  if (idx <= 1) return "***";
  return `${value.slice(0, 1)}***${value.slice(idx)}`;
}

function redactSignal(signal: BriefingSignal) {
  const metadata = (signal.metadata ?? {}) as Record<string, unknown>;
  const senderEmail = metadata.sender_email as string | undefined;
  const organizerEmail = metadata.organizer_email as string | undefined;
  const bodyPreview = metadata.body_preview as string | null | undefined;
  return {
    source_type: signal.source_type,
    source_id: signal.source_id
      ? `${signal.source_id.slice(0, 4)}…${signal.source_id.slice(-4)}`
      : "",
    title: signal.title,
    timestamp: signal.timestamp,
    participants_count: signal.participants?.length ?? 0,
    topics: signal.topics ?? [],
    sender_email: redactEmail(senderEmail),
    organizer_email: redactEmail(organizerEmail),
    body_preview_chars: bodyPreview ? bodyPreview.length : 0,
  };
}

async function main() {
  const feed = process.argv.includes("--feed");

  const result = await fetchOutlookSignalPack({
    mailLookbackDays: 1,
    calendarLookaheadDays: 1,
    includeBodyPreviews: true,
  });

  console.log(`Token status: ${result.tokenStatus}`);
  console.log(
    `Raw counts: mail=${result.rawCounts.mail} calendar=${result.rawCounts.calendar}`,
  );
  if (result.warnings.length > 0) {
    console.log("Warnings:");
    for (const w of result.warnings) console.log(`  - ${w}`);
  }
  if (result.tokenStatus !== "ok") {
    console.error(
      "\nOutlook ingestion is not configured for live use; exiting with a clear message instead of crashing.",
    );
    process.exit(result.tokenStatus === "missing" ? 1 : 2);
  }

  console.log("\nSample signals (redacted):");
  for (const signal of result.signals.slice(0, 5)) {
    console.log(`  ${JSON.stringify(redactSignal(signal))}`);
  }

  if (!feed) return;

  console.log("\nFeeding signals into HCI-04 generation with a fake LLM...");
  const fakeInsights: LLMFirstInsights = {
    narrative: "Smoke check briefing for HCI-07.",
    top_priorities: [],
    recommendations: [],
    proposed_actions: [],
    uncertainty: null,
  };
  const fakeLlm: BriefingLLMClient = {
    async generate() {
      return {
        rawText: JSON.stringify(fakeInsights),
        usage: null,
      };
    },
  };

  const generated = await generateBriefingPackage({
    contextMode: "business",
    signals: result.signals,
    llmClient: fakeLlm,
    dryRun: true,
  });
  console.log(
    `  hygiene removed: ${generated.stats.hygieneExcluded}, final count: ${generated.stats.finalCount}`,
  );
  console.log("Smoke complete.");
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  process.exit(99);
});
