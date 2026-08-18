import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { handleGetSession } from "../src/tools/getSession.js";
import { getDb, closeDb } from "../src/storage/db.js";
import { getOrCreateKey, resetCryptoKey } from "../src/storage/crypto.js";

const testConfig = configSchema.parse({
  version: 1,
  apps: {
    myapp: {
      baseUrl: "http://localhost:3000",
      auth: {
        type: "credentials",
        loginEndpoint: "/api/auth/login",
        tokenPath: "data.token",
      },
      roles: {
        admin: { identifier: "admin@test.local", secretEnvVar: "TEST_ADMIN_SECRET" },
      },
    },
  },
});

describe("handleGetSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-tool-test-"));
    getDb(join(tmpDir, "agentiam.db"));
    getOrCreateKey(join(tmpDir, "key"));

    process.env.TEST_ADMIN_SECRET = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ data: { token: "fake-token-123" } }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TEST_ADMIN_SECRET;
    closeDb();
    resetCryptoKey();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns a successful tool result on a valid call", async () => {
    const result = await handleGetSession(testConfig, { app: "myapp", role: "admin" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.token).toBe("fake-token-123");
  });

  it("returns isError:true with a config_error code for an unknown app, instead of throwing", async () => {
    const result = await handleGetSession(testConfig, { app: "nonexistent", role: "admin" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("config_error");
    expect(parsed.message).toMatch(/No app named "nonexistent"/);
  });

  it("returns isError:true with a target_app_error code on a non-ok login response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({}),
      })
    );

    const result = await handleGetSession(testConfig, { app: "myapp", role: "admin" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("target_app_error");
  });

  it("never writes to stdout during a get_session call", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await handleGetSession(testConfig, { app: "myapp", role: "admin" });

    expect(stdoutSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
