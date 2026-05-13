import { promises as fs } from "node:fs";
import path from "node:path";
import { fernetDecrypt, fernetEncrypt, FernetError } from "./fernet";

/**
 * Read/write the encrypted Microsoft 365 token file produced by the legacy
 * `m365_poc` flow. Encapsulated inside Home so we do not depend on the old
 * FedOS Intelligence repository at runtime; only the encrypted token file on
 * disk is shared.
 */

export type StoredToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  obtained_at?: string;
  token_type?: string;
  scope?: string;
  [key: string]: unknown;
};

export class TokenStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenStoreError";
  }
}

export type TokenStore = {
  load(): Promise<StoredToken | null>;
  save(token: StoredToken): Promise<void>;
};

export function createFileTokenStore(options: {
  tokenPath: string;
  encryptionKey: string;
}): TokenStore {
  if (!options.encryptionKey) {
    throw new TokenStoreError("Token encryption key is required");
  }
  if (!options.tokenPath) {
    throw new TokenStoreError("Token path is required");
  }

  return {
    async load() {
      try {
        const encrypted = await fs.readFile(options.tokenPath);
        const decrypted = fernetDecrypt(
          options.encryptionKey,
          encrypted.toString("utf8"),
        );
        return JSON.parse(decrypted.toString("utf8")) as StoredToken;
      } catch (err) {
        if (
          err instanceof Error &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return null;
        }
        if (err instanceof FernetError) {
          throw new TokenStoreError(`Token decrypt failed: ${err.message}`);
        }
        throw err;
      }
    },

    async save(token) {
      await fs.mkdir(path.dirname(options.tokenPath), { recursive: true });
      const payload = Buffer.from(JSON.stringify(token), "utf8");
      const encrypted = fernetEncrypt(options.encryptionKey, payload);
      await fs.writeFile(options.tokenPath, encrypted, { mode: 0o600 });
    },
  };
}
