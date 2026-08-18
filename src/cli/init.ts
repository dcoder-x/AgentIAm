import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { STARTER_CONFIG_YAML } from "./configTemplate.js";

export class InitError extends Error {}

/**
 * Scaffolds a starter agentiam.config.yaml in cwd. Refuses to
 * overwrite an existing config — "wx" gives an atomic exists-check
 * and write, throwing EEXIST if the file is already there.
 */
export function runInit(cwd: string = process.cwd()): void {
  const target = join(cwd, "agentiam.config.yaml");

  try {
    writeFileSync(target, STARTER_CONFIG_YAML, { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new InitError(`${target} already exists — refusing to overwrite.`);
    }
    throw err;
  }
}
