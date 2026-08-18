import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { configSchema, type ValidatedConfig } from "./schema.js";

export class ConfigError extends Error {}

/**
 * Loads and validates agentiam.config.yaml.
 * Fails loudly and specifically rather than letting a bad config
 * surface as a confusing failure deep inside a tool call.
 */
export function loadConfig(path = "./agentiam.config.yaml"): ValidatedConfig {
  const resolved = resolve(path);

  if (!existsSync(resolved)) {
    throw new ConfigError(
      `No config found at ${resolved}. Run "agentiam init" to create one, ` +
      `or see examples/agentiam.config.yaml for the expected format.`
    );
  }

  let raw: unknown;
  try {
    raw = yaml.load(readFileSync(resolved, "utf8"));
  } catch (err) {
    throw new ConfigError(`Failed to parse ${resolved} as YAML: ${(err as Error).message}`);
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid config at ${resolved}:\n${issues}`);
  }

  return result.data;
}

/**
 * Resolves a role's secret from the environment. Secrets are never
 * stored in the config file itself — only the env var name is.
 */
export function resolveSecret(envVarName: string): string {
  const value = process.env[envVarName];
  if (!value) {
    throw new ConfigError(
      `Environment variable "${envVarName}" is not set. ` +
      `AgentIAm never stores credentials in config — set this in your shell or .env.`
    );
  }
  return value;
}

const ENV_VAR_PLACEHOLDER_RE = /\$\{([A-Z0-9_]+)\}/gi;

/**
 * Resolves ${ENV_VAR_NAME} placeholders in a string from process.env.
 * Used for extraHeaders values so secrets/API keys can be referenced
 * without hardcoding them in config. Unlike resolveSecret, a plain
 * string with no placeholder is returned unchanged — headers may have
 * static, non-secret values.
 */
export function interpolateEnvVars(template: string): string {
  return template.replace(ENV_VAR_PLACEHOLDER_RE, (_match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new ConfigError(
        `Environment variable "${varName}" referenced in config is not set.`
      );
    }
    return value;
  });
}
