import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal Fernet implementation (cryptography.io spec) so Home can read and
 * write the same encrypted Microsoft 365 token file that the legacy FedOS
 * Intelligence PoC produced.
 *
 * Fernet token layout:
 *   version (1)  | timestamp (8 BE)  | iv (16)  | ciphertext (n)  | hmac (32)
 *
 * Key is 32 bytes urlsafe-base64 encoded, split into:
 *   - first  16 bytes: HMAC signing key
 *   - last   16 bytes: AES-128-CBC encryption key
 *
 * Note: HCI-07 keeps this as MVP token storage. A production-grade secret
 * store is tracked under MIG-SEC-01.
 */

const FERNET_VERSION = 0x80;

export class FernetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FernetError";
  }
}

function urlsafeB64Decode(value: string): Buffer {
  // Node accepts standard or urlsafe base64 with base64url.
  return Buffer.from(value, "base64url");
}

function urlsafeB64Encode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function splitKey(key: string): { signingKey: Buffer; encryptionKey: Buffer } {
  const raw = urlsafeB64Decode(key);
  if (raw.length !== 32) {
    throw new FernetError(
      `Fernet key must decode to 32 bytes, got ${raw.length}`,
    );
  }
  return {
    signingKey: raw.subarray(0, 16),
    encryptionKey: raw.subarray(16, 32),
  };
}

export function fernetDecrypt(key: string, token: string): Buffer {
  const { signingKey, encryptionKey } = splitKey(key);
  const data = urlsafeB64Decode(token);

  if (data.length < 1 + 8 + 16 + 32 || data[0] !== FERNET_VERSION) {
    throw new FernetError("Invalid Fernet token");
  }

  const hmacOffset = data.length - 32;
  const signed = data.subarray(0, hmacOffset);
  const providedHmac = data.subarray(hmacOffset);
  const expectedHmac = createHmac("sha256", signingKey).update(signed).digest();
  if (
    providedHmac.length !== expectedHmac.length ||
    !timingSafeEqual(providedHmac, expectedHmac)
  ) {
    throw new FernetError("Fernet HMAC verification failed");
  }

  const iv = data.subarray(9, 25);
  const ciphertext = data.subarray(25, hmacOffset);
  const decipher = createDecipheriv("aes-128-cbc", encryptionKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function fernetEncrypt(
  key: string,
  plaintext: Buffer,
  options: { iv?: Buffer; timestampSeconds?: number } = {},
): string {
  const { signingKey, encryptionKey } = splitKey(key);
  const iv = options.iv ?? randomBytes(16);
  if (iv.length !== 16) throw new FernetError("Fernet IV must be 16 bytes");

  const cipher = createCipheriv("aes-128-cbc", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const timestamp = Math.floor(
    options.timestampSeconds ?? Date.now() / 1000,
  );
  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigUInt64BE(BigInt(timestamp));

  const versionBuf = Buffer.from([FERNET_VERSION]);
  const signed = Buffer.concat([versionBuf, timestampBuf, iv, ciphertext]);
  const hmac = createHmac("sha256", signingKey).update(signed).digest();
  return urlsafeB64Encode(Buffer.concat([signed, hmac]));
}
