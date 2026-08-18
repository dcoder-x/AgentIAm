import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config/schema.js";
import { getOrRefreshSession } from "../src/auth/sessionProvider.js";
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

describe("getOrRefreshSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-test-"));
    getDb(join(tmpDir, "agentiam.db")); // seed the singleton with an isolated db path
    getOrCreateKey(join(tmpDir, "key")); // seed the singleton with an isolated key path

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

  it("logs in and returns a token when nothing is cached", async () => {
    const result = await getOrRefreshSession(testConfig, "myapp", "admin");
    expect(result.token).toBe("fake-token-123");
    expect(result.cached).toBe(false);
  });

  it("throws a clear error for an unknown role", async () => {
    await expect(getOrRefreshSession(testConfig, "myapp", "nonexistent")).rejects.toThrow(
      /No role named "nonexistent"/
    );
  });

  it("throws a clear error when the secret env var is missing", async () => {
    delete process.env.TEST_ADMIN_SECRET;
    await expect(getOrRefreshSession(testConfig, "myapp", "admin")).rejects.toThrow(
      /TEST_ADMIN_SECRET/
    );
  });

  it("sends a resolved env-var interpolated value in extraHeaders", async () => {
    process.env.TEST_API_KEY = "key-abc";
    const configWithHeaders = configSchema.parse({
      version: 1,
      apps: {
        myapp: {
          baseUrl: "http://localhost:3000",
          auth: {
            type: "credentials",
            loginEndpoint: "/api/auth/login",
            tokenPath: "data.token",
            extraHeaders: { "X-Api-Key": "${TEST_API_KEY}" },
          },
          roles: {
            admin: { identifier: "admin@test.local", secretEnvVar: "TEST_ADMIN_SECRET" },
          },
        },
      },
    });

    await getOrRefreshSession(configWithHeaders, "myapp", "admin");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.headers["X-Api-Key"]).toBe("key-abc");

    delete process.env.TEST_API_KEY;
  });

  it("throws before any network call when an extraHeaders env var is missing", async () => {
    const configWithHeaders = configSchema.parse({
      version: 1,
      apps: {
        myapp: {
          baseUrl: "http://localhost:3000",
          auth: {
            type: "credentials",
            loginEndpoint: "/api/auth/login",
            tokenPath: "data.token",
            extraHeaders: { "X-Api-Key": "${TEST_MISSING_API_KEY}" },
          },
          roles: {
            admin: { identifier: "admin@test.local", secretEnvVar: "TEST_ADMIN_SECRET" },
          },
        },
      },
    });

    await expect(getOrRefreshSession(configWithHeaders, "myapp", "admin")).rejects.toThrow(
      /TEST_MISSING_API_KEY/
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws a distinguishable error when the login request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        return Promise.reject(err);
      })
    );

    const configWithTimeout = configSchema.parse({
      version: 1,
      apps: {
        myapp: {
          baseUrl: "http://localhost:3000",
          auth: {
            type: "credentials",
            loginEndpoint: "/api/auth/login",
            tokenPath: "data.token",
            requestTimeoutMs: 5,
          },
          roles: {
            admin: { identifier: "admin@test.local", secretEnvVar: "TEST_ADMIN_SECRET" },
          },
        },
      },
    });

    await expect(getOrRefreshSession(configWithTimeout, "myapp", "admin")).rejects.toThrow(
      /timed out after 5ms/
    );
  });

  it("rejects a non-http(s) login URL before calling fetch", async () => {
    const configWithBadUrl = configSchema.parse({
      version: 1,
      apps: {
        myapp: {
          baseUrl: "file:///etc/passwd",
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

    await expect(getOrRefreshSession(configWithBadUrl, "myapp", "admin")).rejects.toThrow(
      /only http and https URLs are allowed/
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
