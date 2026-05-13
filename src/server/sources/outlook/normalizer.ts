import type { BriefingSignal } from "@/server/sources/llm-first-signals";
import type { GraphCalendarEvent, GraphMailMessage } from "./graph-client";

/**
 * Map raw Microsoft Graph payloads onto Home `BriefingSignal` objects.
 *
 * Port of FedOS Intelligence `outlook_normalizer.py`. Preserves the field
 * mappings documented in HCI-07: `summary` stays a short source descriptor,
 * `metadata.body_preview` carries the (capped) inline preview, and topic
 * extraction is a lightweight keyword split.
 */

export const MAIL_BODY_PREVIEW_MAX_CHARS = 300;

export function normalizeMailItem(raw: GraphMailMessage): BriefingSignal {
  const senderObj = raw.from?.emailAddress ?? {};
  const senderName = senderObj.name || senderObj.address || "unknown sender";
  const senderEmail = (senderObj.address ?? "").toLowerCase();

  const subject = raw.subject || "(no subject)";
  const toRecipients = (raw.toRecipients ?? [])
    .map((r) => (r.emailAddress?.address ?? "").toLowerCase())
    .filter((a) => a.length > 0);

  return {
    source_type: "outlook_mail",
    source_id: raw.id ?? "",
    source_link: raw.webLink ?? null,
    title: subject,
    summary: `Email from ${senderName}`,
    timestamp: raw.receivedDateTime ?? null,
    participants: [senderName],
    topics: extractTopics(subject),
    metadata: {
      is_read: Boolean(raw.isRead),
      sender_name: senderName,
      sender_email: senderEmail,
      to_recipients: toRecipients,
      body_preview: cleanPreviewText(raw.bodyPreview ?? null),
      conversation_id: raw.conversationId ?? null,
    },
  };
}

export function normalizeCalendarItem(raw: GraphCalendarEvent): BriefingSignal {
  const organizerObj = raw.organizer?.emailAddress ?? {};
  const organizerName =
    organizerObj.name || organizerObj.address || "unknown organizer";
  const organizerEmail = (organizerObj.address ?? "").toLowerCase();

  const subject = raw.subject || "(no title)";
  const start = raw.start?.dateTime ?? null;
  const end = raw.end?.dateTime ?? null;

  const attendees = raw.attendees ?? [];
  const attendeeEmails = attendees
    .map((a) => (a.emailAddress?.address ?? "").toLowerCase())
    .filter((a) => a.length > 0);

  const participantSet = new Set<string>([organizerName]);
  for (const attendee of attendees) {
    const name =
      attendee.emailAddress?.name || attendee.emailAddress?.address;
    if (name) participantSet.add(name);
  }

  return {
    source_type: "outlook_calendar",
    source_id: raw.id ?? "",
    source_link: raw.webLink ?? null,
    title: subject,
    summary: `Meeting organised by ${organizerName}`,
    timestamp: start,
    participants: [...participantSet],
    topics: extractTopics(subject),
    metadata: {
      event_start: start,
      event_end: end,
      organizer_email: organizerEmail,
      attendee_emails: attendeeEmails,
    },
  };
}

export function normalizeOutlookPayload(payload: {
  mail: GraphMailMessage[];
  calendar: GraphCalendarEvent[];
}): BriefingSignal[] {
  return [
    ...payload.mail.map(normalizeMailItem),
    ...payload.calendar.map(normalizeCalendarItem),
  ];
}

export function enrichMailSignalWithBodyPreview(
  signal: BriefingSignal,
  raw: GraphMailMessage,
): BriefingSignal {
  const metadata: Record<string, unknown> = { ...(signal.metadata ?? {}) };
  metadata.body_preview = cleanPreviewText(raw.bodyPreview ?? null);

  const senderObj = raw.from?.emailAddress;
  if (senderObj) {
    metadata.sender_name =
      senderObj.name || senderObj.address || metadata.sender_name;
    metadata.sender_email =
      (senderObj.address ?? "").toLowerCase() || metadata.sender_email;
  }

  const rawToRecipients = (raw.toRecipients ?? [])
    .map((r) => (r.emailAddress?.address ?? "").toLowerCase())
    .filter((a) => a.length > 0);
  if (rawToRecipients.length > 0) metadata.to_recipients = rawToRecipients;

  return { ...signal, metadata };
}

export function extractTopics(title: string): string[] {
  return title
    .split(/\s+/)
    .map((word) => word.replace(/^[\[\](),.!?:-]+|[\[\](),.!?:-]+$/g, "").toLowerCase())
    .filter((word) => word.length > 4)
    .slice(0, 5);
}

export function cleanPreviewText(value: string | null): string | null {
  if (!value) return null;
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).join(" "))
    .filter((line) => line.length > 0);
  const joined = lines.join(" ").trim();
  if (!joined) return null;
  return joined.slice(0, MAIL_BODY_PREVIEW_MAX_CHARS);
}
