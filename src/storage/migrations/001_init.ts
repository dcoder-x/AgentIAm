// Mirrors 001_init.sql (kept alongside it for readability/SQL tooling).
// Inlined as a TS string constant, not read from disk at runtime, so
// `tsc` bundles it into dist/ automatically — a plain .sql file isn't
// copied by the TypeScript compiler and would 404 in a built package.
//
// v1: session cache only. Tables for created identities (v2) and
// teardown audit log (v3) are added in later migrations, not here,
// so v1 stays small and its schema is easy to review.
//
// Tokens are encrypted at rest (AES-256-GCM, see src/storage/crypto.ts)
// using a key stored at ~/.agentiam/key. Upgrading from a pre-encryption
// version of agentiam? Delete ~/.agentiam/agentiam.db — there is no
// in-place migration for the old plaintext `token` column.

export const MIGRATION_001_INIT = `
CREATE TABLE IF NOT EXISTS sessions (
  app               TEXT NOT NULL,
  role              TEXT NOT NULL,
  token_ciphertext  TEXT NOT NULL,
  token_iv          TEXT NOT NULL,
  token_auth_tag    TEXT NOT NULL,
  header_name       TEXT NOT NULL,
  expires_at        INTEGER NOT NULL, -- epoch ms
  updated_at        INTEGER NOT NULL, -- epoch ms
  PRIMARY KEY (app, role)
);
`;
