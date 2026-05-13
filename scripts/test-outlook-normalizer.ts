/**
 * Fixture tests for the Outlook normalizer. Runs via `npx tsx`.
 *
 * Uses redacted Graph-shaped payloads so we never check in real Microsoft
 * data. Exits with code 0 on success, code 1 on any assertion failure.
 */
import { strict as assert } from "node:assert";
import {
  cleanPreviewText,
  enrichMailSignalWithBodyPreview,
  extractTopics,
  normalizeCalendarItem,
  normalizeMailItem,
  normalizeOutlookPayload,
  MAIL_BODY_PREVIEW_MAX_CHARS,
} from "@/server/sources/outlook";

const mailFixture = {
  id: "AAMkAGI0fake-mail-id-1",
  subject: "Q3 board pre-read draft",
  from: {
    emailAddress: { name: "Maria Rossi", address: "Maria@example.com" },
  },
  toRecipients: [
    { emailAddress: { name: "Federico", address: "Federico@example.com" } },
    { emailAddress: { address: "exec-list@example.com" } },
  ],
  receivedDateTime: "2026-05-12T07:30:00Z",
  isRead: false,
  webLink: "https://outlook.office.com/owa/?ItemID=fake",
  conversationId: "AAQ-conv-1",
  bodyPreview: "Hi Federico,\n\nSharing the v2 draft.   Need your edits by Wednesday. Thanks!",
};

const calendarFixture = {
  id: "AAMkAGI0fake-event-id-1",
  subject: "EMEA growth review",
  start: { dateTime: "2026-05-12T09:00:00", timeZone: "UTC" },
  end: { dateTime: "2026-05-12T09:30:00", timeZone: "UTC" },
  organizer: {
    emailAddress: { name: "Luca Bianchi", address: "Luca@example.com" },
  },
  attendees: [
    { emailAddress: { name: "Maria Rossi", address: "Maria@example.com" } },
    { emailAddress: { address: "luigi@example.com" } },
  ],
  webLink: "https://outlook.office.com/calendar/?ItemID=fake",
};

function testMailNormalizer() {
  const signal = normalizeMailItem(mailFixture);
  assert.equal(signal.source_type, "outlook_mail");
  assert.equal(signal.source_id, mailFixture.id);
  assert.equal(signal.source_link, mailFixture.webLink);
  assert.equal(signal.title, "Q3 board pre-read draft");
  assert.equal(signal.summary, "Email from Maria Rossi");
  assert.equal(signal.timestamp, "2026-05-12T07:30:00Z");
  assert.deepEqual(signal.participants, ["Maria Rossi"]);

  const meta = signal.metadata!;
  assert.equal(meta.is_read, false);
  assert.equal(meta.sender_name, "Maria Rossi");
  assert.equal(meta.sender_email, "maria@example.com");
  assert.deepEqual(meta.to_recipients, [
    "federico@example.com",
    "exec-list@example.com",
  ]);
  assert.equal(meta.conversation_id, "AAQ-conv-1");
  assert.equal(
    meta.body_preview,
    "Hi Federico, Sharing the v2 draft. Need your edits by Wednesday. Thanks!",
  );
}

function testMailMissingFields() {
  const signal = normalizeMailItem({ id: "x" });
  assert.equal(signal.title, "(no subject)");
  assert.equal(signal.summary, "Email from unknown sender");
  assert.equal(signal.metadata!.sender_email, "");
  assert.equal(signal.metadata!.body_preview, null);
}

function testCalendarNormalizer() {
  const signal = normalizeCalendarItem(calendarFixture);
  assert.equal(signal.source_type, "outlook_calendar");
  assert.equal(signal.source_id, calendarFixture.id);
  assert.equal(signal.title, "EMEA growth review");
  assert.equal(signal.summary, "Meeting organised by Luca Bianchi");
  assert.equal(signal.timestamp, "2026-05-12T09:00:00");
  assert.ok(signal.participants!.includes("Luca Bianchi"));
  assert.ok(signal.participants!.includes("Maria Rossi"));
  assert.ok(signal.participants!.includes("luigi@example.com"));

  const meta = signal.metadata!;
  assert.equal(meta.event_start, "2026-05-12T09:00:00");
  assert.equal(meta.event_end, "2026-05-12T09:30:00");
  assert.equal(meta.organizer_email, "luca@example.com");
  assert.deepEqual(meta.attendee_emails, [
    "maria@example.com",
    "luigi@example.com",
  ]);
}

function testTopicExtraction() {
  assert.deepEqual(extractTopics("Q3 [board] pre-read draft, please!"), [
    "board",
    "pre-read",
    "draft",
    "please",
  ]);
  assert.deepEqual(extractTopics(""), []);
}

function testPreviewCleaning() {
  const long = "x".repeat(500);
  const cleaned = cleanPreviewText(`Top line\n\n  ${long}`);
  assert.equal(cleaned!.length, MAIL_BODY_PREVIEW_MAX_CHARS);
  assert.equal(cleanPreviewText(null), null);
  assert.equal(cleanPreviewText("   \n\n"), null);
}

function testEnrichment() {
  const base = normalizeMailItem(mailFixture);
  // Strip body preview to simulate metadata-only first pass.
  base.metadata!.body_preview = null;
  const enriched = enrichMailSignalWithBodyPreview(base, mailFixture);
  assert.equal(
    enriched.metadata!.body_preview,
    "Hi Federico, Sharing the v2 draft. Need your edits by Wednesday. Thanks!",
  );
  // Source signal is not mutated by reference.
  assert.equal(base.metadata!.body_preview, null);
}

function testOutlookPayload() {
  const signals = normalizeOutlookPayload({
    mail: [mailFixture],
    calendar: [calendarFixture],
  });
  assert.equal(signals.length, 2);
  assert.equal(signals[0].source_type, "outlook_mail");
  assert.equal(signals[1].source_type, "outlook_calendar");
}

const tests: Array<[string, () => void]> = [
  ["mail normalizer maps key Graph fields", testMailNormalizer],
  ["mail normalizer tolerates missing fields", testMailMissingFields],
  ["calendar normalizer maps key Graph fields", testCalendarNormalizer],
  ["topic extraction filters short words", testTopicExtraction],
  ["preview cleaning caps and trims", testPreviewCleaning],
  ["enrichment adds body preview without mutating input", testEnrichment],
  ["payload normalizer returns both kinds", testOutlookPayload],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(err);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} outlook normalizer tests passed.`);
