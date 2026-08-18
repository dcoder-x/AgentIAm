import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

let key: Buffer | null = null;

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Reads (or generates on first run) the local encryption key used to
 * encrypt cached tokens at rest. Lives at ~/.agentiam/key by default,
 * sibling to the SQLite store, mode 0600 (best-effort — chmod is a
 * no-op on Windows).
 */
export function getOrCreateKey(keyPathOverride?: string): Buffer {
  if (key) return key;

  let keyPath: string;
  if (keyPathOverride) {
    keyPath = keyPathOverride;
  } else {
    const dir = join(homedir(), ".agentiam");
    mkdirSync(dir, { recursive: true });
    keyPath = join(dir, "key");
  }

  if (existsSync(keyPath)) {
    key = readFileSync(keyPath);
  } else {
    key = randomBytes(KEY_LENGTH);
    writeFileSync(keyPath, key, { mode: 0o600 });
    try {
      chmodSync(keyPath, 0o600);
    } catch {
      // best-effort; no-op on platforms without POSIX permissions (Windows)
    }
  }

  return key;
}

/** Test-only: forces the next getOrCreateKey call to re-read/generate. */
export function resetCryptoKey(): void {
  key = null;
}

export function encryptToken(plaintext: string, encryptionKey: Buffer): EncryptedToken {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptToken(
  ciphertext: string,
  iv: string,
  authTag: string,
  encryptionKey: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
