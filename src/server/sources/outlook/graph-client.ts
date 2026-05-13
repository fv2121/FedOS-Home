/**
 * Microsoft Graph HTTP client for FedOS Home. Read-only MVP scope; mirrors
 * the legacy FedOS Intelligence connector, using `fetch` directly so we do
 * not depend on the legacy Python runtime.
 */

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export class GraphAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphAuthError";
  }
}

export type GraphMailMessage = {
  id: string;
  subject?: string | null;
  from?: { emailAddress?: { name?: string; address?: string } } | null;
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string | null;
  isRead?: boolean;
  webLink?: string | null;
  conversationId?: string | null;
  bodyPreview?: string | null;
};

export type GraphCalendarEvent = {
  id: string;
  subject?: string | null;
  start?: { dateTime?: string; timeZone?: string } | null;
  end?: { dateTime?: string; timeZone?: string } | null;
  organizer?: { emailAddress?: { name?: string; address?: string } } | null;
  attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  webLink?: string | null;
};

export type RefreshedToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  obtained_at: string;
  token_type?: string;
  scope?: string;
  [key: string]: unknown;
};

export type GraphClient = {
  refreshToken(refreshToken: string): Promise<RefreshedToken>;
  getMailMetadata(args: {
    accessToken: string;
    top: number;
    sinceIso?: string;
  }): Promise<{ value: GraphMailMessage[] }>;
  getMessageBodyPreview(args: {
    accessToken: string;
    messageId: string;
  }): Promise<GraphMailMessage>;
  getCalendarView(args: {
    accessToken: string;
    startIso: string;
    endIso: string;
    top: number;
  }): Promise<{ value: GraphCalendarEvent[] }>;
};

export function createGraphClient(options: {
  clientId: string;
  clientSecret: string;
  authority: string;
  scopes: string[];
  fetchImpl?: typeof fetch;
}): GraphClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function refreshToken(refreshToken: string): Promise<RefreshedToken> {
    const body = new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: options.scopes.join(" "),
    });
    const url = `${options.authority.replace(/\/$/, "")}/oauth2/v2.0/token`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GraphAuthError(
        `Token refresh failed: ${response.status} ${text || response.statusText}`,
      );
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      ...data,
      access_token: String(data.access_token ?? ""),
      obtained_at: new Date().toISOString(),
    } as RefreshedToken;
  }

  async function getJson<T>(
    accessToken: string,
    pathname: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${GRAPH_BASE_URL}${pathname}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GraphAuthError(
        `Graph request failed: ${response.status} ${text || response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }

  return {
    refreshToken,
    async getMailMetadata({ accessToken, top, sinceIso }) {
      return getJson<{ value: GraphMailMessage[] }>(accessToken, "/me/messages", {
        $top: top,
        $orderby: "receivedDateTime desc",
        $select:
          "id,subject,from,toRecipients,receivedDateTime,isRead,webLink,conversationId",
        $filter: sinceIso ? `receivedDateTime ge ${sinceIso}` : undefined,
      });
    },
    async getMessageBodyPreview({ accessToken, messageId }) {
      const encoded = encodeURIComponent(messageId);
      return getJson<GraphMailMessage>(accessToken, `/me/messages/${encoded}`, {
        $select:
          "id,subject,from,toRecipients,receivedDateTime,isRead,webLink,conversationId,bodyPreview",
      });
    },
    async getCalendarView({ accessToken, startIso, endIso, top }) {
      return getJson<{ value: GraphCalendarEvent[] }>(
        accessToken,
        "/me/calendarView",
        {
          startDateTime: startIso,
          endDateTime: endIso,
          $top: top,
          $orderby: "start/dateTime",
          $select: "id,subject,start,end,organizer,attendees,webLink",
        },
      );
    },
  };
}
