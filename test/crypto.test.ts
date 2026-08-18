import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import {
  getOrCreateKey,
  resetCryptoKey,
  encryptToken,
  decryptToken,
} from "../src/storage/crypto.js";

describe("crypto", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-crypto-test-"));
    resetCryptoKey();
  });

  afterEach(() => {
    resetCryptoKey();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getOrCreateKey", () => {
    it("creates a 32-byte key on first call", () => {
      const key = getOrCreateKey(join(tmpDir, "key"));
      expect(key).toHaveLength(32);
    });

    it("returns the same key on subsequent calls with the same path", () => {
      const keyPath = join(tmpDir, "key");
      const first = getOrCreateKey(keyPath);
      resetCryptoKey();
      const second = getOrCreateKey(keyPath);
      expect(second.equals(first)).toBe(true);
    });

    it("sets restrictive file permissions where the platform supports it", () => {
      const keyPath = join(tmpDir, "key");
      getOrCreateKey(keyPath);
      if (platform() !== "win32") {
        const mode = statSync(keyPath).mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });
  });

  describe("encryptToken / decryptToken", () => {
    it("round-trips plaintext", () => {
      const key = getOrCreateKey(join(tmpDir, "key"));
      const encrypted = encryptToken("super-secret-token", key);
      const decrypted = decryptToken(encrypted.ciphertext, encrypted.iv, encrypted.authTag, key);
      expect(decrypted).toBe("super-secret-token");
    });

    it("uses a different iv/ciphertext for each call", () => {
      const key = getOrCreateKey(join(tmpDir, "key"));
      const a = encryptToken("same-plaintext", key);
      const b = encryptToken("same-plaintext", key);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("throws on a tampered auth tag", () => {
      const key = getOrCreateKey(join(tmpDir, "key"));
      const encrypted = encryptToken("super-secret-token", key);
      const tamperedTag = Buffer.from(encrypted.authTag, "base64");
      tamperedTag[0] ^= 0xff;
      expect(() =>
        decryptToken(encrypted.ciphertext, encrypted.iv, tamperedTag.toString("base64"), key)
      ).toThrow();
    });

    it("throws on tampered ciphertext", () => {
      const key = getOrCreateKey(join(tmpDir, "key"));
      const encrypted = encryptToken("super-secret-token", key);
      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, "base64");
      tamperedCiphertext[0] ^= 0xff;
      expect(() =>
        decryptToken(tamperedCiphertext.toString("base64"), encrypted.iv, encrypted.authTag, key)
      ).toThrow();
    });
  });
});
