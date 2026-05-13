import type { BriefingSignal } from "@/server/sources/llm-first-signals";
import { loadOutlookConfig, OutlookConfigError, type OutlookConfig } from "./config";
import { createFileTokenStore, TokenStoreError, type StoredToken, type TokenStore } from "./token-store";
import { createGraphClient, GraphAuthError, type GraphClient } from "./graph-client";
import {
  enrichMailSignalWithBodyPreview,
  normalizeCalendarItem,
  normalizeMailItem,
} from "./normalizer";

/**
 * Public Home ingestion entry point. Fetches a small Outlook mail/calendar
 * window, normalizes the records into the `BriefingSignal` shape expected by
 * the HCI-04 generation service, and reports counts/warnings/token status.
 *
 * Returns gracefully (with `tokenStatus !== "ok"` and an empty signals list)
 * when the local token configuration is missing or the token cannot be
 * refreshed, so callers can render a clear "not connected" surface instead
 * of crashing.
 */

export type FetchOutlookSignalPackInput = {
  mailLookbackDays?: number;
  mailMaxResults?: number;
  calendarLookaheadDays?: number;
  calendarMaxResults?: number;
  includeBodyPreviews?: boolean;
  config?: OutlookConfig;
  tokenStore?: TokenStore;
  graphClient?: GraphClient;
  now?: () => Date;
};

export type OutlookTokenStatus = "ok" | "missing" | "expired" | "refresh_failed";

export type FetchOutlookSignalPackResult = {
  signals: BriefingSignal[];
  rawCounts: { mail: number; calendar: number };
  warnings: string[];
  tokenStatus: OutlookTokenStatus;
};

const DEFAULTS = {
  mailLookbackDays: 1,
  mailMaxResults: 50,
  calendarLookaheadDays: 1,
  calendarMaxResults: 50,
  includeBodyPreviews: true,
} as const;

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

function emptyResult(
  tokenStatus: OutlookTokenStatus,
  warnings: string[],
): FetchOutlookSignalPackResult {
  return {
    signals: [],
    rawCounts: { mail: 0, calendar: 0 },
    warnings,
    tokenStatus,
  };
}

function isTokenValid(token: StoredToken, now: Date): boolean {
  const obtainedAt = token.obtained_at ? new Date(token.obtained_at) : null;
  const expiresInSeconds =
    typeof token.expires_in === "number" ? token.expires_in : 0;
  if (!obtainedAt || Number.isNaN(obtainedAt.getTime()) || expiresInSeconds <= 0) {
    return false;
  }
  const expiresAt = obtainedAt.getTime() + expiresInSeconds * 1000;
  return now.getTime() < expiresAt - ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

export async function fetchOutlookSignalPack(
  input: FetchOutlookSignalPackInput = {},
): Promise<FetchOutlookSignalPackResult> {
  const opts = {
    mailLookbackDays: input.mailLookbackDays ?? DEFAULTS.mailLookbackDays,
    mailMaxResults: input.mailMaxResults ?? DEFAULTS.mailMaxResults,
    calendarLookaheadDays:
      input.calendarLookaheadDays ?? DEFAULTS.calendarLookaheadDays,
    calendarMaxResults:
      input.calendarMaxResults ?? DEFAULTS.calendarMaxResults,
    includeBodyPreviews:
      input.includeBodyPreviews ?? DEFAULTS.includeBodyPreviews,
  };
  const now = (input.now ?? (() => new Date()))();

  let config: OutlookConfig;
  try {
    config = input.config ?? loadOutlookConfig();
  } catch (err) {
    if (err instanceof OutlookConfigError) {
      return emptyResult("missing", [err.message]);
    }
    throw err;
  }

  let tokenStore: TokenStore;
  try {
    tokenStore =
      input.tokenStore ??
      createFileTokenStore({
        tokenPath: config.tokenPath,
        encryptionKey: config.tokenEncryptionKey,
      });
  } catch (err) {
    if (err instanceof TokenStoreError) {
      return emptyResult("missing", [err.message]);
    }
    throw err;
  }

  const graph =
    input.graphClient ??
    createGraphClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: config.authority,
      scopes: config.scopes,
    });

  let token: StoredToken | null;
  try {
    token = await tokenStore.load();
  } catch (err) {
    if (err instanceof TokenStoreError) {
      return emptyResult("missing", [err.message]);
    }
    throw err;
  }
  if (!token || !token.access_token) {
    return emptyResult("missing", [
      "No Microsoft token found. Authenticate via the m365 PoC flow first.",
    ]);
  }

  if (!isTokenValid(token, now)) {
    if (!token.refresh_token) {
      return emptyResult("expired", [
        "Access token expired and no refresh token is available.",
      ]);
    }
    try {
      const refreshed = await graph.refreshToken(token.refresh_token);
      const merged: StoredToken = { ...token, ...refreshed };
      await tokenStore.save(merged);
      token = merged;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return emptyResult("refresh_failed", [`Token refresh failed: ${message}`]);
    }
  }

  const warnings: string[] = [];
  const accessToken = token.access_token;

  const sinceIso = new Date(
    now.getTime() - opts.mailLookbackDays * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const endIso = new Date(
    now.getTime() + opts.calendarLookaheadDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  let mailRaw: Awaited<ReturnType<GraphClient["getMailMetadata"]>>;
  try {
    mailRaw = await graph.getMailMetadata({
      accessToken,
      top: opts.mailMaxResults,
      sinceIso,
    });
  } catch (err) {
    if (err instanceof GraphAuthError) {
      warnings.push(`Mail fetch failed: ${err.message}`);
      mailRaw = { value: [] };
    } else {
      throw err;
    }
  }

  let calendarRaw: Awaited<ReturnType<GraphClient["getCalendarView"]>>;
  try {
    calendarRaw = await graph.getCalendarView({
      accessToken,
      startIso: now.toISOString(),
      endIso,
      top: opts.calendarMaxResults,
    });
  } catch (err) {
    if (err instanceof GraphAuthError) {
      warnings.push(`Calendar fetch failed: ${err.message}`);
      calendarRaw = { value: [] };
    } else {
      throw err;
    }
  }

  const mailSignals = mailRaw.value.map(normalizeMailItem);
  const calendarSignals = calendarRaw.value.map(normalizeCalendarItem);

  if (opts.includeBodyPreviews && mailRaw.value.length > 0) {
    const enriched: BriefingSignal[] = [];
    for (let idx = 0; idx < mailSignals.length; idx += 1) {
      const signal = mailSignals[idx];
      try {
        const detail = await graph.getMessageBodyPreview({
          accessToken,
          messageId: mailRaw.value[idx].id,
        });
        enriched.push(enrichMailSignalWithBodyPreview(signal, detail));
      } catch (err) {
        if (err instanceof GraphAuthError) {
          warnings.push(`Body preview failed for one message: ${err.message}`);
          enriched.push(signal);
          continue;
        }
        throw err;
      }
    }
    mailSignals.splice(0, mailSignals.length, ...enriched);
  }

  return {
    signals: [...mailSignals, ...calendarSignals],
    rawCounts: { mail: mailRaw.value.length, calendar: calendarRaw.value.length },
    warnings,
    tokenStatus: "ok",
  };
}
