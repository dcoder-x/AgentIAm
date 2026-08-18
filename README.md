# AgentIAm

**Agent Identity MCP for testing your own product.**

Coding agents (Claude Code, Cursor, etc.) get stuck at authentication when
testing web apps — they can't sign up or log in on their own, so a human ends
up manually creating test accounts and copy-pasting tokens. AgentIAm is an
MCP server that gives your agent a valid test session on request instead.

## What this is NOT

- Not for creating accounts on third-party platforms or social media
- Not for bypassing real OAuth providers (Google, GitHub, etc.) — only works
  against mock/test identity providers already present in your own codebase
- Not for production environments
- Not for evading anti-bot or anti-fraud protection on systems you don't own

This tool is for testing products you control, in staging/test environments,
using test accounts you've seeded yourself.

## Status: v1 — session provisioning

v1 does one thing: given a configured app and role, it logs in (or reuses a
cached, still-valid session) and hands your agent a token. That's it.

`create_identity`, `read_inbox`, and `teardown_identity` are registered as
tools so their shape is visible, but return "not implemented" — they're
planned for v2 and v3. See `PRODUCT_SPEC.md` for the full roadmap.

## Quickstart

```bash
npx agentiam init   # scaffolds ./agentiam.config.yaml (refuses to overwrite an existing one)
# edit agentiam.config.yaml for your app
export MYAPP_ADMIN_PASSWORD="..."   # matches secretEnvVar in your config
npx agentiam
```

Secrets can also be set in a `.env` file in your project root (gitignore it) —
AgentIAm loads it automatically on startup.

Point your MCP client (e.g. Claude Code) at this server, then call:

```json
{ "tool": "get_session", "args": { "app": "myapp", "role": "admin" } }
```

## Token storage

Cached session tokens are encrypted at rest (AES-256-GCM) in
`~/.agentiam/agentiam.db`, using a key stored alongside it at
`~/.agentiam/key`. This protects tokens against casual disk browsing,
backups, or accidentally copying/committing the database file — it does
**not** protect against an attacker who already has full access to your
user account (same threat model as most local CLI credential caches, e.g.
AWS CLI or `gh`). Delete `~/.agentiam/` at any time to clear all cached
sessions and force AgentIAm to generate a new key.

> **Upgrading from an older AgentIAm version?** The session cache schema
> changed to support encryption. Delete `~/.agentiam/agentiam.db` after
> upgrading — there's no in-place migration for the old plaintext format.

## Known limitations

- **Concurrent `get_session` calls for the same app+role aren't de-duplicated.**
  If two calls race while nothing is cached yet, both may independently log in
  before either writes to the cache. This is wasteful (an extra login against
  your target app) but not unsafe — the last write wins and the cache ends up
  consistent either way. Not expected to matter for the typical usage pattern
  (one agent, one MCP client, calls made one at a time).

- **Graceful shutdown (SIGINT/SIGTERM) is not fully reliable on Windows** when
  AgentIAm is launched and terminated programmatically as a child process
  (the normal way an MCP client runs it) — a Node.js/Windows platform
  limitation, not specific to AgentIAm. Interactive Ctrl+C works reliably on
  all platforms. An unclean exit is still safe (no data loss — SQLite runs in
  WAL mode), just not graceful.

## Development

```bash
npm run dev     # run the server directly with tsx
npm run build   # compile to dist/
npm test        # run the test suite
```

## License

AGPL-3.0. See `LICENSE`.
