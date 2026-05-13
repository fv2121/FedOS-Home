import type { BriefingSignal } from "@/server/sources/llm-first-signals";

/**
 * Shared redaction + token-estimation helpers for the HCI-08 debug console.
 *
 * Rules:
 * - never emit access tokens, refresh tokens, encryption keys, client
 *   secrets, auth cookies, or raw token-file content
 * - never emit full email bodies; keep the capped body preview from HCI-07
 * - mask email addresses to first-letter + domain
 * - truncate Graph IDs so we keep enough for support but not for sharing
 */

export type RedactedSignal = {
  source_type: string;
  source_id: string;
  source_link_present: boolean;
  title: string;
  summary: string | null;
  timestamp: string | null;
  participants_count: number;
  topics: string[];
  metadata: Record<string, unknown>;
};

export function maskEmail(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  const at = value.indexOf("@");
  if (at <= 1) return "***";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function maskEmailsInText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (email) => maskEmail(email),
  );
}

export function maskId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function redactSignal(signal: BriefingSignal): RedactedSignal {
  const meta = (signal.metadata ?? {}) as Record<string, unknown>;
  const senderEmail = asString(meta.sender_email);
  const organizerEmail = asString(meta.organizer_email);
  const toRecipients = Array.isArray(meta.to_recipients)
    ? (meta.to_recipients as unknown[]).map(maskEmail)
    : undefined;
  const attendeeEmails = Array.isArray(meta.attendee_emails)
    ? (meta.attendee_emails as unknown[]).map(maskEmail)
    : undefined;
  const bodyPreview = asString(meta.body_preview);

  const redactedMeta: Record<string, unknown> = {};
  if (meta.is_read !== undefined) redactedMeta.is_read = Boolean(meta.is_read);
  if (meta.sender_name !== undefined) {
    redactedMeta.sender_name = maskEmailsInText(meta.sender_name) ?? meta.sender_name;
  }
  if (senderEmail !== null) redactedMeta.sender_email = maskEmail(senderEmail);
  if (toRecipients) redactedMeta.to_recipients = toRecipients;
  if (meta.conversation_id !== undefined) {
    redactedMeta.conversation_id = maskId(meta.conversation_id);
  }
  if (meta.event_start !== undefined) redactedMeta.event_start = meta.event_start;
  if (meta.event_end !== undefined) redactedMeta.event_end = meta.event_end;
  if (organizerEmail !== null) {
    redactedMeta.organizer_email = maskEmail(organizerEmail);
  }
  if (attendeeEmails) redactedMeta.attendee_emails = attendeeEmails;
  if (bodyPreview !== null) {
    const redactedPreview = maskEmailsInText(bodyPreview) ?? bodyPreview;
    redactedMeta.body_preview_chars = bodyPreview.length;
    redactedMeta.body_preview = redactedPreview.slice(0, 160);
  }

  return {
    source_type: signal.source_type,
    source_id: maskId(signal.source_id),
    source_link_present: Boolean(signal.source_link),
    title: maskEmailsInText(signal.title) ?? signal.title,
    summary: maskEmailsInText(signal.summary) ?? signal.summary ?? null,
    timestamp:
      signal.timestamp instanceof Date
        ? signal.timestamp.toISOString()
        : typeof signal.timestamp === "string"
          ? signal.timestamp
          : null,
    participants_count: signal.participants?.length ?? 0,
    topics: signal.topics ?? [],
    metadata: redactedMeta,
  };
}

/**
 * Rough heuristic — Anthropic/OpenAI both fall around 4 chars per token in
 * English. Good enough for a console preview; not used for billing.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
