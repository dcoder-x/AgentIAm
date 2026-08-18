import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { interpolateEnvVars, ConfigError } from "../src/config/loader.js";

describe("interpolateEnvVars", () => {
  beforeEach(() => {
    process.env.AGENTIAM_TEST_API_KEY = "abc123";
  });

  afterEach(() => {
    delete process.env.AGENTIAM_TEST_API_KEY;
  });

  it("resolves a single placeholder", () => {
    expect(interpolateEnvVars("${AGENTIAM_TEST_API_KEY}")).toBe("abc123");
  });

  it("resolves a placeholder embedded in a larger string", () => {
    expect(interpolateEnvVars("Bearer ${AGENTIAM_TEST_API_KEY}")).toBe("Bearer abc123");
  });

  it("resolves multiple placeholders in one string", () => {
    process.env.AGENTIAM_TEST_SUFFIX = "xyz";
    expect(interpolateEnvVars("${AGENTIAM_TEST_API_KEY}-${AGENTIAM_TEST_SUFFIX}")).toBe(
      "abc123-xyz"
    );
    delete process.env.AGENTIAM_TEST_SUFFIX;
  });

  it("leaves plain strings with no placeholder unchanged", () => {
    expect(interpolateEnvVars("application/json")).toBe("application/json");
  });

  it("throws a ConfigError naming the missing variable", () => {
    expect(() => interpolateEnvVars("${AGENTIAM_TEST_MISSING}")).toThrow(ConfigError);
    expect(() => interpolateEnvVars("${AGENTIAM_TEST_MISSING}")).toThrow(
      /AGENTIAM_TEST_MISSING/
    );
  });
});
