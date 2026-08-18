import { z } from "zod";

// Mirrors src/types/index.ts but as a runtime-validated schema, so a
// malformed agentiam.config.yaml fails fast with a clear message
// instead of surfacing as a confusing runtime error later.

const roleSchema = z.object({
  identifier: z.string().min(1, "role.identifier is required"),
  secretEnvVar: z.string().min(1, "role.secretEnvVar is required"),
});

const authSchema = z.object({
  type: z.enum(["credentials", "oauth-mock"]),
  loginEndpoint: z.string().min(1, "auth.loginEndpoint is required"),
  tokenPath: z.string().min(1, "auth.tokenPath is required"),
  headerName: z.string().default("Authorization"),
  headerPrefix: z.string().default("Bearer "),
  defaultTtlSeconds: z.number().positive().default(3600),
  // How to encode the login request body. Defaults to json (matches v1's
  // original hardcoded behavior).
  bodyEncoding: z.enum(["json", "form-urlencoded"]).default("json"),
  // Template for the login request body using {{identifier}}/{{secret}}
  // placeholders, e.g. `{"email":"{{identifier}}","password":"{{secret}}"}`.
  // Left optional with no default: an absent bodyTemplate is a distinct
  // code path (the legacy identifier/secret shape), not an empty string.
  bodyTemplate: z.string().optional(),
  // Additional headers to send on the login request. Values support
  // ${ENV_VAR_NAME} interpolation, resolved from process.env at request time.
  extraHeaders: z.record(z.string(), z.string()).optional(),
  // Timeout in ms for the login request.
  requestTimeoutMs: z.number().positive().default(10000),
});

const appSchema = z.object({
  baseUrl: z.string().url("app.baseUrl must be a valid URL"),
  auth: authSchema,
  roles: z.record(z.string(), roleSchema).refine(
    (roles) => Object.keys(roles).length > 0,
    { message: "each app must define at least one role" }
  ),
});

export const configSchema = z.object({
  version: z.literal(1),
  apps: z.record(z.string(), appSchema).refine(
    (apps) => Object.keys(apps).length > 0,
    { message: "config must define at least one app" }
  ),
});

export type ValidatedConfig = z.infer<typeof configSchema>;
