// Mirrors examples/agentiam.config.yaml (kept in sync manually — low
// churn for a single reference file). Inlined as a TS string constant,
// not read from disk at runtime, for the same reason as
// src/storage/migrations/001_init.ts: `tsc` doesn't copy non-TS assets
// into dist/, and examples/agentiam.config.yaml isn't shipped relative
// to dist/ at a predictable runtime path.

export const STARTER_CONFIG_YAML = `# AgentIAm v1 config — session provisioning only.
# Copy this to ./agentiam.config.yaml in your project root and edit.
#
# AgentIAm never stores credentials here. Each role points to an
# environment variable name; set the actual secret in your shell
# or a .env file that's gitignored.

version: 1

apps:
  myapp:
    baseUrl: "http://localhost:3000"
    auth:
      type: credentials
      loginEndpoint: "/api/auth/login"
      # Dot-path into the login response JSON where the token lives
      tokenPath: "data.token"
      headerName: "Authorization"
      headerPrefix: "Bearer "
      defaultTtlSeconds: 3600

      # --- Optional: only needed if your login endpoint doesn't accept
      # --- {"identifier": "...", "secret": "..."} as a JSON body (the default).

      # How to encode the login request body: "json" (default) or "form-urlencoded".
      # bodyEncoding: json

      # Custom request body shape, using {{identifier}}/{{secret}} placeholders.
      # Values are escaped automatically for the chosen bodyEncoding, so they're
      # safe to substitute even if they contain quotes, backslashes, or &/=.
      # If omitted, AgentIAm sends {"identifier": "...", "secret": "..."} (or the
      # form-urlencoded equivalent).
      # bodyTemplate: |
      #   {"email": "{{identifier}}", "password": "{{secret}}"}

      # Extra headers to send on the login request, e.g. an API key required
      # alongside credentials. Values support \${ENV_VAR_NAME} interpolation,
      # resolved from your shell/.env at request time — never hardcode a real
      # secret here.
      # extraHeaders:
      #   X-Api-Key: "\${MYAPP_API_KEY}"

      # Timeout (ms) for the login request. Defaults to 10000.
      # requestTimeoutMs: 10000
    roles:
      admin:
        identifier: "admin@test.myapp.local"
        secretEnvVar: "MYAPP_ADMIN_PASSWORD"
      free_tier:
        identifier: "free@test.myapp.local"
        secretEnvVar: "MYAPP_FREE_TIER_PASSWORD"
`;
