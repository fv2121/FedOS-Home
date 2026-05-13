/**
 * LLM-first signal types, hygiene, deduplication, compaction, and formatting.
 *
 * Ported from FedOS Intelligence:
 *   app/reasoning/llm_first_hygiene.py
 *   app/reasoning/llm_first_compaction.py
 *   app/prompts/llm_first_brief.py (_format_signal)
 *
 * Behavior preservation goals:
 * - Hygiene removes obvious machine noise only; no scoring or ranking.
 * - Calendar items are never dropped by hygiene.
 * - Dedup keeps the first occurrence by source_id.
 * - Compaction groups by conversation_id (mail) or normalized subject + sender.
 * - Group records preserve `source_ids` so proposed actions remain traceable.
 */

export type BriefingSignal = {
  source_type: string;
  source_id: string;
  source_link?: string | null;
  title: string;
  summary?: string | null;
  timestamp?: string | Date | null;
  participants?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
};

export type CompactedBriefingSignal = BriefingSignal & {
  source_ids?: string[];
};

export const HYGIENE_SENDER_PATTERNS = [
  "mailer-daemon",
  "postmaster",
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "bounce@",
  "bounces@",
  "notifications@",
  "notification@",
  "automated@",
  "auto-reply@",
  "autoreply@",
  "automailer@",
  "do_not_reply@",
  "noti@",
] as const;

export const HYGIENE_SUBJECT_PATTERNS = [
  "automatic reply",
  "auto reply",
  "autoreply",
  "out of office",
  "out-of-office",
  "delivery failure",
  "delivery failed",
  "mail delivery",
  "undeliverable",
  "failed to deliver",
  "bounce notification",
  "auto-generated",
  "auto generated",
  "do not reply",
  "do not respond",
  "this is an automated",
  "this message was sent automatically",
  "you are receiving this email because",
  "unsubscribe",
] as const;

export type HygieneOptions = {
  senderPatterns?: readonly string[];
  subjectPatterns?: readonly string[];
  excludeIfOnlyCc?: boolean;
};

export type HygieneResult = {
  kept: BriefingSignal[];
  excluded: number;
};

function getMetadata(signal: BriefingSignal): Record<string, unknown> {
  return (signal.metadata ?? {}) as Record<string, unknown>;
}

function asLowerString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function applyHygieneFilters(
  items: BriefingSignal[],
  options: HygieneOptions = {},
): HygieneResult {
  const senderPats = (options.senderPatterns ?? HYGIENE_SENDER_PATTERNS).map((p) =>
    p.toLowerCase(),
  );
  const subjectPats = (options.subjectPatterns ?? HYGIENE_SUBJECT_PATTERNS).map((p) =>
    p.toLowerCase(),
  );
  const excludeIfOnlyCc = options.excludeIfOnlyCc ?? false;

  const kept: BriefingSignal[] = [];
  let excluded = 0;

  for (const item of items) {
    if (item.source_type !== "outlook_mail") {
      kept.push(item);
      continue;
    }
    const meta = getMetadata(item);
    const sender = asLowerString(meta.sender_email);
    const subject = asLowerString(item.title);

    if (senderPats.some((p) => sender.includes(p))) {
      excluded += 1;
      continue;
    }
    if (subjectPats.some((p) => subject.includes(p))) {
      excluded += 1;
      continue;
    }
    if (excludeIfOnlyCc && meta.is_only_cc === true) {
      excluded += 1;
      continue;
    }
    kept.push(item);
  }

  return { kept, excluded };
}

export type DedupResult = {
  deduped: BriefingSignal[];
  duplicates: number;
};

export function deduplicateSignals(items: BriefingSignal[]): DedupResult {
  const seen = new Set<string>();
  const deduped: BriefingSignal[] = [];
  let duplicates = 0;
  for (const item of items) {
    const sid = item.source_id ?? "";
    if (seen.has(sid)) {
      duplicates += 1;
      continue;
    }
    seen.add(sid);
    deduped.push(item);
  }
  return { deduped, duplicates };
}

const SUBJECT_PREFIX_RE = /^\s*(re|fw|fwd)\s*:\s*/i;
const MAX_PREVIEWS_PER_GROUP = 2;

function normalizeSubject(value: string | null | undefined): string {
  if (!value) return "";
  let text = value.trim();
  while (true) {
    const stripped = text.replace(SUBJECT_PREFIX_RE, "");
    if (stripped === text) break;
    text = stripped;
  }
  return text.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

function tsKey(item: BriefingSignal): string {
  const ts = item.timestamp;
  if (ts === null || ts === undefined || ts === "") return "";
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

type GroupKey = readonly [kind: "mail_conv" | "mail_subj" | "cal_subj", key: string];

function groupKey(item: BriefingSignal): GroupKey | null {
  const meta = getMetadata(item);
  if (item.source_type === "outlook_mail") {
    const convId = meta.conversation_id;
    if (typeof convId === "string" && convId.length > 0) {
      return ["mail_conv", convId];
    }
    const subj = normalizeSubject(item.title);
    const sender = asLowerString(meta.sender_email);
    if (subj && sender) return ["mail_subj", `${sender}|${subj}`];
    return null;
  }
  if (item.source_type === "outlook_calendar") {
    const subj = normalizeSubject(item.title);
    const organizer = asLowerString(meta.organizer_email);
    if (subj && organizer) return ["cal_subj", `${organizer}|${subj}`];
    return null;
  }
  return null;
}

function buildMailGroup(members: BriefingSignal[]): CompactedBriefingSignal {
  const sorted = [...members].sort((a, b) => tsKey(b).localeCompare(tsKey(a)));
  const latest = sorted[0];
  const latestMeta = getMetadata(latest);

  const sourceIds = sorted.map((m) => m.source_id).filter((s): s is string => Boolean(s));
  const unreadCount = sorted.reduce(
    (n, m) => (getMetadata(m).is_read === false ? n + 1 : n),
    0,
  );

  const previews: string[] = [];
  for (const m of sorted) {
    const preview = getMetadata(m).body_preview;
    if (typeof preview === "string" && preview.length > 0 && !previews.includes(preview)) {
      previews.push(preview);
    }
    if (previews.length >= MAX_PREVIEWS_PER_GROUP) break;
  }

  const participants: string[] = [];
  const seenParticipants = new Set<string>();
  for (const m of sorted) {
    for (const p of m.participants ?? []) {
      if (p && !seenParticipants.has(p)) {
        seenParticipants.add(p);
        participants.push(p);
      }
    }
  }

  return {
    source_type: "outlook_mail_group",
    source_id: latest.source_id,
    source_ids: sourceIds,
    source_link: latest.source_link ?? null,
    title: latest.title ?? "",
    summary: `Mail thread (${sorted.length} messages)`,
    timestamp: latest.timestamp ?? null,
    participants,
    topics: latest.topics ?? [],
    metadata: {
      group_count: sorted.length,
      unread_count: unreadCount,
      sender_name: latestMeta.sender_name,
      sender_email: latestMeta.sender_email,
      to_recipients: latestMeta.to_recipients ?? [],
      previews,
      conversation_id: latestMeta.conversation_id,
      source_ids: sourceIds,
    },
  };
}

function buildCalendarGroup(members: BriefingSignal[]): CompactedBriefingSignal {
  const sorted = [...members].sort((a, b) => tsKey(b).localeCompare(tsKey(a)));
  const latest = sorted[0];
  const latestMeta = getMetadata(latest);

  const sourceIds = sorted.map((m) => m.source_id).filter((s): s is string => Boolean(s));

  const participants: string[] = [];
  const seenParticipants = new Set<string>();
  for (const m of sorted) {
    for (const p of m.participants ?? []) {
      if (p && !seenParticipants.has(p)) {
        seenParticipants.add(p);
        participants.push(p);
      }
    }
  }

  return {
    source_type: "outlook_calendar_group",
    source_id: latest.source_id,
    source_ids: sourceIds,
    source_link: latest.source_link ?? null,
    title: latest.title ?? "",
    summary: `Meeting updates (${sorted.length} entries)`,
    timestamp: latest.timestamp ?? null,
    participants,
    topics: latest.topics ?? [],
    metadata: {
      group_count: sorted.length,
      organizer_email: latestMeta.organizer_email,
      event_start: latestMeta.event_start,
      event_end: latestMeta.event_end,
      source_ids: sourceIds,
    },
  };
}

export type CompactionResult = {
  compacted: CompactedBriefingSignal[];
  collapsed: number;
  groups: number;
};

export function compactSignals(items: BriefingSignal[]): CompactionResult {
  const buckets = new Map<string, { kind: GroupKey[0]; members: BriefingSignal[] }>();
  const firstIndex = new Map<string, number>();
  const passthrough: Array<[number, CompactedBriefingSignal]> = [];

  items.forEach((item, idx) => {
    const key = groupKey(item);
    if (!key) {
      passthrough.push([idx, item as CompactedBriefingSignal]);
      return;
    }
    const composite = `${key[0]}::${key[1]}`;
    if (!buckets.has(composite)) {
      buckets.set(composite, { kind: key[0], members: [] });
      firstIndex.set(composite, idx);
    }
    buckets.get(composite)!.members.push(item);
  });

  const emissions: Array<[number, CompactedBriefingSignal]> = [...passthrough];
  let collapsed = 0;
  let groups = 0;

  for (const [composite, bucket] of buckets) {
    const idx = firstIndex.get(composite)!;
    if (bucket.members.length === 1) {
      emissions.push([idx, bucket.members[0] as CompactedBriefingSignal]);
      continue;
    }
    const grouped =
      bucket.kind === "cal_subj"
        ? buildCalendarGroup(bucket.members)
        : buildMailGroup(bucket.members);
    emissions.push([idx, grouped]);
    collapsed += bucket.members.length - 1;
    groups += 1;
  }

  emissions.sort((a, b) => a[0] - b[0]);
  return { compacted: emissions.map(([, item]) => item), collapsed, groups };
}

// ── Formatting ─────────────────────────────────────────────────────────────

function quote(value: string): string {
  return `"${(value ?? "").replace(/"/g, "'").replace(/[\r\n]+/g, " ")}"`;
}

function tsString(ts: BriefingSignal["timestamp"]): string {
  if (!ts) return "";
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

export function formatSignal(item: CompactedBriefingSignal): string {
  const meta = getMetadata(item);
  const sourceType = item.source_type ?? "unknown";
  const ts = tsString(item.timestamp);
  const title = item.title ?? "";
  const sid = item.source_id ?? "";
  const parts: string[] = [];
  if (sid) parts.push(`id=${sid}`);
  if (ts) parts.push(`ts=${ts}`);

  if (sourceType === "outlook_mail") {
    if (meta.is_read === false) parts.push("unread=true");
    const senderName = (meta.sender_name as string) ?? "";
    const senderEmail = (meta.sender_email as string) ?? "";
    if (senderName || senderEmail) {
      parts.push(`from=${quote(`${senderName} <${senderEmail}>`.trim())}`);
    }
    const toList = ((meta.to_recipients as string[]) ?? []).filter(Boolean).slice(0, 5);
    if (toList.length > 0) parts.push(`to=${quote(toList.join(","))}`);
    if (title) parts.push(`title=${quote(title)}`);
    const preview = meta.body_preview;
    if (typeof preview === "string" && preview) parts.push(`preview=${quote(preview)}`);
    return `MAIL ${parts.join(" ")}`;
  }

  if (sourceType === "outlook_calendar") {
    const people = (item.participants ?? []).filter(Boolean).slice(0, 6);
    if (people.length > 0) parts.push(`people=${quote(people.join(", "))}`);
    if (title) parts.push(`title=${quote(title)}`);
    if (item.summary) parts.push(`summary=${quote(item.summary)}`);
    return `CAL ${parts.join(" ")}`;
  }

  if (sourceType === "outlook_mail_group") {
    const groupParts: string[] = [];
    const ids = (meta.source_ids as string[]) ?? (sid ? [sid] : []);
    if (ids.length > 0) groupParts.push(`ids=[${ids.join(",")}]`);
    if (ts) groupParts.push(`latest_ts=${ts}`);
    const count = meta.group_count;
    if (typeof count === "number" && count > 0) groupParts.push(`count=${count}`);
    const unread = meta.unread_count;
    if (typeof unread === "number" && unread > 0) groupParts.push(`unread_count=${unread}`);
    const senderName = (meta.sender_name as string) ?? "";
    const senderEmail = (meta.sender_email as string) ?? "";
    if (senderName || senderEmail) {
      groupParts.push(`latest_from=${quote(`${senderName} <${senderEmail}>`.trim())}`);
    }
    if (title) groupParts.push(`title=${quote(title)}`);
    const previews = (meta.previews as string[]) ?? [];
    previews.forEach((p, i) => groupParts.push(`preview${i + 1}=${quote(p)}`));
    return `MAIL_GROUP ${groupParts.join(" ")}`;
  }

  if (sourceType === "outlook_calendar_group") {
    const groupParts: string[] = [];
    const ids = (meta.source_ids as string[]) ?? (sid ? [sid] : []);
    if (ids.length > 0) groupParts.push(`ids=[${ids.join(",")}]`);
    if (ts) groupParts.push(`latest_ts=${ts}`);
    const count = meta.group_count;
    if (typeof count === "number" && count > 0) groupParts.push(`count=${count}`);
    const people = (item.participants ?? []).filter(Boolean).slice(0, 6);
    if (people.length > 0) groupParts.push(`people=${quote(people.join(", "))}`);
    if (title) groupParts.push(`title=${quote(title)}`);
    if (item.summary) groupParts.push(`summary=${quote(item.summary)}`);
    return `CAL_GROUP ${groupParts.join(" ")}`;
  }

  if (title) parts.push(`title=${quote(title)}`);
  if (item.summary) parts.push(`summary=${quote(item.summary)}`);
  return `${sourceType.toUpperCase()} ${parts.join(" ")}`;
}

export function formatSignalPack(items: CompactedBriefingSignal[]): string {
  const lines = [
    `SIGNAL PACK (${items.length} signals — hygiene-filtered, not pre-ranked):\n` +
      `Signals are presented in retrieval order. You decide what matters.\n`,
  ];
  if (items.length === 0) {
    lines.push("No signals available today.");
  } else {
    for (const item of items) lines.push(formatSignal(item));
  }
  return lines.join("\n");
}
