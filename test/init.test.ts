import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { runInit, InitError } from "../src/cli/init.js";
import { STARTER_CONFIG_YAML } from "../src/cli/configTemplate.js";
import { configSchema } from "../src/config/schema.js";

describe("runInit", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes agentiam.config.yaml with the expected starter content", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-init-test-"));
    runInit(tmpDir);

    const written = readFileSync(join(tmpDir, "agentiam.config.yaml"), "utf8");
    expect(written).toBe(STARTER_CONFIG_YAML);
  });

  it("refuses to overwrite an existing config, leaving it untouched", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-init-test-"));
    const target = join(tmpDir, "agentiam.config.yaml");
    writeFileSync(target, "# pre-existing user config\n");

    expect(() => runInit(tmpDir)).toThrow(InitError);
    expect(() => runInit(tmpDir)).toThrow(/already exists/);
    expect(readFileSync(target, "utf8")).toBe("# pre-existing user config\n");
  });

  it("the written content round-trips through the current config schema", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentiam-init-test-"));
    runInit(tmpDir);

    const written = readFileSync(join(tmpDir, "agentiam.config.yaml"), "utf8");
    const parsed = configSchema.safeParse(yaml.load(written));
    expect(parsed.success).toBe(true);
  });
});
