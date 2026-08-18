// Core types shared across AgentIAm.
// v1 scope: session provisioning only. Fields for v2 (creation) and
// v3 (cleanup) are present but marked accordingly so the config
// schema doesn't need to change shape later.

export interface RoleConfig {
  /** Identifier sent to the login endpoint (email, username, etc.) */
  identifier: string;
  /** Name of the environment variable holding the secret (never store the secret in config directly) */
  secretEnvVar: string;
}

export type AuthType = "credentials" | "oauth-mock";

export interface AppAuthConfig {
  type: AuthType;
  /** Endpoint that accepts credentials and returns a session/token */
  loginEndpoint: string;
  /** Dot-path into the login response where the token lives, e.g. "data.token" */
  tokenPath: string;
  /** Header name to use when presenting the token, e.g. "Authorization" */
  headerName?: string;
  /** Prefix before the token in the header, e.g. "Bearer " */
  headerPrefix?: string;
  /** Rough seconds-to-expiry if the response doesn't say. Used to decide when to refresh. */
  defaultTtlSeconds?: number;
  /** How to encode the login request body. Defaults to json. */
  bodyEncoding?: "json" | "form-urlencoded";
  /**
   * Template for the login request body using {{identifier}}/{{secret}}
   * placeholders. If omitted, defaults to the legacy shape: a JSON
   * identifier/secret object, or equivalent form-encoded pairs.
   */
  bodyTemplate?: string;
  /**
   * Additional headers to send on the login request. Values support
   * env-var interpolation, resolved from process.env at request time.
   */
  extraHeaders?: Record<string, string>;
  /** Timeout in ms for the login request. Defaults to 10000. */
  requestTimeoutMs?: number;
}

export interface AppConfig {
  baseUrl: string;
  auth: AppAuthConfig;
  roles: Record<string, RoleConfig>;
}

export interface AgentIAmConfig {
  /** Config format version, so future breaking changes can be migrated */
  version: 1;
  apps: Record<string, AppConfig>;
}

export interface SessionResult {
  app: string;
  role: string;
  token: string;
  headerName: string;
  expiresAt: number; // epoch ms
  cached: boolean;
}
