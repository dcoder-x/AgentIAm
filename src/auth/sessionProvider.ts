import { getDb } from "../storage/db.js";
import { getOrCreateKey, encryptToken, decryptToken } from "../storage/crypto.js";
import { resolveSecret, interpolateEnvVars } from "../config/loader.js";
import { renderBodyTemplate, renderDefaultBody, contentTypeFor } from "./bodyTemplate.js";
import type { ValidatedConfig } from "../config/schema.js";
import type { SessionResult } from "../types/index.js";

const REFRESH_SKEW_MS = 30_000; // refresh a little before actual expiry

function getAtPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function readCached(app: string, role: string): SessionResult | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM sessions WHERE app = ? AND role = ?")
    .get(app, role) as
    | {
        token_ciphertext: string;
        token_iv: string;
        token_auth_tag: string;
        header_name: string;
        expires_at: number;
      }
    | undefined;

  if (!row) return null;
  if (row.expires_at - REFRESH_SKEW_MS <= Date.now()) return null; // expired or about to be

  let token: string;
  try {
    const key = getOrCreateKey();
    token = decryptToken(row.token_ciphertext, row.token_iv, row.token_auth_tag, key);
  } catch {
    // Corrupt cache entry or rotated key — treat as a miss and re-login
    // rather than crashing the tool call.
    return null;
  }

  return {
    app,
    role,
    token,
    headerName: row.header_name,
    expiresAt: row.expires_at,
    cached: true,
  };
}

function writeCache(result: SessionResult): void {
  const db = getDb();
  const key = getOrCreateKey();
  const encrypted = encryptToken(result.token, key);

  db.prepare(
    `INSERT INTO sessions (app, role, token_ciphertext, token_iv, token_auth_tag, header_name, expires_at, updated_at)
     VALUES (@app, @role, @tokenCiphertext, @tokenIv, @tokenAuthTag, @headerName, @expiresAt, @updatedAt)
     ON CONFLICT(app, role) DO UPDATE SET
       token_ciphertext = excluded.token_ciphertext,
       token_iv = excluded.token_iv,
       token_auth_tag = excluded.token_auth_tag,
       header_name = excluded.header_name,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  ).run({
    app: result.app,
    role: result.role,
    tokenCiphertext: encrypted.ciphertext,
    tokenIv: encrypted.iv,
    tokenAuthTag: encrypted.authTag,
    headerName: result.headerName,
    expiresAt: result.expiresAt,
    updatedAt: Date.now(),
  });
}

/**
 * Returns a valid session for (app, role) — from cache if still
 * fresh, otherwise by logging in against the app's configured
 * auth endpoint. This is the entire v1 feature surface.
 */
export async function getOrRefreshSession(
  config: ValidatedConfig,
  app: string,
  role: string
): Promise<SessionResult> {
  const cached = readCached(app, role);
  if (cached) return cached;

  const appConfig = config.apps[app];
  if (!appConfig) {
    throw new Error(`No app named "${app}" in config. Known apps: ${Object.keys(config.apps).join(", ")}`);
  }

  const roleConfig = appConfig.roles[role];
  if (!roleConfig) {
    throw new Error(`No role named "${role}" for app "${app}". Known roles: ${Object.keys(appConfig.roles).join(", ")}`);
  }

  if (appConfig.auth.type !== "credentials") {
    throw new Error(
      `Auth type "${appConfig.auth.type}" for app "${app}" is not supported in v1. ` +
      `v1 only supports "credentials" (username/password style login).`
    );
  }

  const secret = resolveSecret(roleConfig.secretEnvVar);
  const loginUrl = new URL(appConfig.auth.loginEndpoint, appConfig.baseUrl);

  if (loginUrl.protocol !== "http:" && loginUrl.protocol !== "https:") {
    throw new Error(
      `Refusing to send login request to "${loginUrl}" for app "${app}": ` +
      `only http and https URLs are allowed (got "${loginUrl.protocol}").`
    );
  }

  const bodyEncoding = appConfig.auth.bodyEncoding ?? "json";
  const bodyValues = { identifier: roleConfig.identifier, secret };
  const requestBody = appConfig.auth.bodyTemplate
    ? renderBodyTemplate(appConfig.auth.bodyTemplate, bodyValues, bodyEncoding)
    : renderDefaultBody(bodyValues, bodyEncoding);

  const resolvedExtraHeaders: Record<string, string> = {};
  for (const [headerKey, headerValue] of Object.entries(appConfig.auth.extraHeaders ?? {})) {
    resolvedExtraHeaders[headerKey] = interpolateEnvVars(headerValue);
  }

  const requestTimeoutMs = appConfig.auth.requestTimeoutMs ?? 10000;

  let response: Response;
  try {
    response = await fetch(loginUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": contentTypeFor(bodyEncoding),
        ...resolvedExtraHeaders,
      },
      body: requestBody,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `Login request to "${loginUrl}" for app "${app}" timed out after ${requestTimeoutMs}ms. ` +
        `The target app may be down or unreachable.`
      );
    }
    throw new Error(
      `Login request to "${loginUrl}" for app "${app}" failed: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Login failed for app "${app}" role "${role}": ${response.status} ${response.statusText}`
    );
  }

  const body = await response.json();
  const token = getAtPath(body, appConfig.auth.tokenPath);
  if (typeof token !== "string") {
    throw new Error(
      `Could not find a string token at path "${appConfig.auth.tokenPath}" in the login response for app "${app}". ` +
      `Check auth.tokenPath in your config against the actual response shape.`
    );
  }

  const ttlMs = (appConfig.auth.defaultTtlSeconds ?? 3600) * 1000;
  const result: SessionResult = {
    app,
    role,
    token,
    headerName: appConfig.auth.headerName ?? "Authorization",
    expiresAt: Date.now() + ttlMs,
    cached: false,
  };

  writeCache(result);
  return result;
}
