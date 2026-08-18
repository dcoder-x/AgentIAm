import { describe, it, expect, afterEach } from "vitest";
import { configSchema } from "../src/config/schema.js";
import { startServer } from "../src/server/mcpServer.js";

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

describe("startServer", () => {
  let server: Awaited<ReturnType<typeof startServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("resolves to a Server instance exposing close(), so callers can shut it down gracefully", async () => {
    server = await startServer(testConfig);
    expect(typeof server.close).toBe("function");
  });
});
