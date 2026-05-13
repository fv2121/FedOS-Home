/**
 * Home-owned configuration for Microsoft Graph / Outlook ingestion.
 *
 * Mirrors the legacy FedOS Intelligence settings, but is fully encapsulated
 * inside Home so we never reach into the old repo at runtime.
 *
 * Required env vars for live use:
 *   - M365_CLIENT_ID
 *   - M365_CLIENT_SECRET
 *   - M365_TOKEN_ENCRYPTION_KEY  (urlsafe base64 32 bytes, Fernet key)
 *   - M365_TOKEN_PATH            (absolute path to the encrypted token file)
 *
 * Optional:
 *   - M365_TENANT_ID   (defaults to "common")
 *   - M365_SCOPES      (space separated, defaults to the read-only MVP set)
 */

export const DEFAULT_SCOPES =
  "openid profile offline_access User.Read Mail.Read Calendars.Read";

export type OutlookConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  authority: string;
  scopes: string[];
  tokenPath: string;
  tokenEncryptionKey: string;
};

export class OutlookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutlookConfigError";
  }
}

export function loadOutlookConfig(): OutlookConfig {
  const clientId = process.env.M365_CLIENT_ID ?? "";
  const clientSecret = process.env.M365_CLIENT_SECRET ?? "";
  const tenantId = process.env.M365_TENANT_ID || "common";
  const tokenPath = process.env.M365_TOKEN_PATH ?? "";
  const tokenEncryptionKey = process.env.M365_TOKEN_ENCRYPTION_KEY ?? "";
  const scopesRaw = process.env.M365_SCOPES || DEFAULT_SCOPES;

  const missing: string[] = [];
  if (!clientId) missing.push("M365_CLIENT_ID");
  if (!clientSecret) missing.push("M365_CLIENT_SECRET");
  if (!tokenPath) missing.push("M365_TOKEN_PATH");
  if (!tokenEncryptionKey) missing.push("M365_TOKEN_ENCRYPTION_KEY");

  if (missing.length > 0) {
    throw new OutlookConfigError(
      `Missing Outlook configuration: ${missing.join(", ")}`,
    );
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    scopes: scopesRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
    tokenPath,
    tokenEncryptionKey,
  };
}
