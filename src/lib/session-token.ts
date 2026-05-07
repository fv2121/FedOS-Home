import crypto from "node:crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SIGNATURE_HEX_LENGTH = 64;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET environment variable is required in production");
    }
    return "dev-secret-only-in-dev";
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(user = "primary"): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${user}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [user, expiresAtRaw, providedSig] = parts;
  const expiresAt = Number(expiresAtRaw);

  if (!user || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  if (!new RegExp(`^[0-9a-f]{${SIGNATURE_HEX_LENGTH}}$`, "i").test(providedSig)) {
    return false;
  }

  const expected = sign(`${user}.${expiresAt}`);
  const providedBuffer = Buffer.from(providedSig, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
