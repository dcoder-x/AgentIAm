# AgentIAm — Product Spec & Development Strategy

**Agent Identity MCP for Testing Products**

## Problem

AI coding agents (Claude Code, Cursor, etc.) get stuck when testing web apps that require authentication. The agent can write and run tests, but can't get past signup/login on its own — developers end up manually creating test accounts, logging in, and copy-pasting tokens so the agent can test authenticated parts of the app. This happens repeatedly, across every project.

Existing session-reuse tooling (Playwright `storageState`, Cypress `cy.session()`) solves a piece of this, but requires explicit per-app config and isn't callable by an agent mid-session — it's not agent-native.

## Vision

An open-source MCP server that gives coding/testing agents scoped, ephemeral test identities for **the developer's own product** — provision, use, and tear down test accounts without human intervention, for staging/test environments only.

## Explicit Non-Goals

- **Not** for creating accounts on third-party platforms or social media
- **Not** for bypassing real OAuth providers (Google, GitHub, etc.) — only works against mock/test identity providers that already exist in the target codebase
- **Not** for production environments
- **Not** for evading anti-bot or anti-fraud protection on systems the user doesn't own or control

These boundaries are stated up front in the README, and enforced technically where possible (see Risk Mitigation) rather than left as a policy statement alone.

## Product Roadmap

### v1 — Session Provisioning
- MCP server exposes a tool like `get_session(app, role)`
- Per-project config describes existing seeded test users/roles (admin, free-tier, expired-trial, etc.) and how to authenticate (login endpoint, credential shape)
- Fetches and auto-refreshes tokens/cookies on request
- Agent calls the tool instead of a human copying and pasting a token
- Ships first — solves the immediate, validated pain point directly, with the smallest possible trust/security surface

### v2 — Account Creation
- Agent inspects the codebase (routes, DTOs/schemas, validation rules) to infer the signup flow and construct a valid request, rather than requiring manual config
- Fake user data (name, email local-part, address, birthdate, etc.) generated via `@faker-js/faker` — the actively maintained fork, not the original `faker.js` (sabotaged and pulled from npm in 2022). Seeded deterministically per test run (`faker.seed(n)`) so a failing test's generated data is reproducible, not different on every run. Locale-aware, since apps with non-US user bases (e.g. Nigerian phone/address formats) would otherwise fail validation on data-shape grounds unrelated to a real bug.
- Retry loop: agent uses server-returned validation errors to correct fields it got wrong
- Disposable, project-scoped email inbox (e.g. `run-<id>@project.agentiam.dev`) — agent calls `read_inbox()` to retrieve confirmation links or OTP codes
- SMS: bring-your-own-provider. AgentIAm manages inbox-reading logic; the user supplies their own Twilio/SNS-style credentials — not hosting phone numbers centrally
- **OAuth: AgentIAm ships its own mock OAuth/OIDC provider.** Rather than requiring the target app to already have a mock IdP, AgentIAm runs a local server implementing the standard OAuth2/OIDC endpoints (`/authorize`, `/token`, `/userinfo`, `/.well-known/openid-configuration`) and returns realistic, Google/Facebook-shaped claims (email, sub, name, picture) — following the same proven pattern as tools like `mock-oauth2-server`. Nothing calls the real Google/Facebook APIs; the whole exchange happens between the agent and AgentIAm.
  - **Requires the app's OAuth client config to be pointed at AgentIAm's mock endpoints for the test/staging environment** — an environment-variable or config override, not a code change, but apps that hardcode `accounts.google.com` directly won't work without the developer adjusting that first. Document this as a real compatibility requirement, not an edge case.
  - **Tests flow shape, not provider reality.** Proves the app correctly handles a successful/failed OAuth callback, parses claims, and creates a session. Does *not* prove the integration works against real Google/Facebook (consent-screen edge cases, scope quirks, real JWKS verification). State this distinction explicitly in docs so passing AgentIAm OAuth tests is never mistaken for "login definitely works in prod."
  - **Simulate the protocol, not the brand.** The mock consent screen is clearly labeled as AgentIAm's own — no recreation of Google/Facebook's actual logos or consent UI. Protocol simulation is standard test infra; visual cloning of a real provider's branded screens is a trademark/phishing-adjacent problem even with good intent.

### v3 — Lifecycle Management & Cleanup
- Automatic teardown of created test accounts and associated data after a test run
- Addresses test-data pollution in staging databases — an underserved gap in existing tooling
- Audit log of identities created/destroyed per run

## Architecture (high level)

- **MCP server** (local or self-hosted), exposing tools: `get_session`, `create_identity`, `read_inbox`, `teardown_identity`
- **Per-project config** (YAML/JSON): environment URLs, existing seeded roles, auth style (JWT / cookie / OAuth), optional mock IdP details
- **Disposable mail**: project-scoped inboxes on a domain AgentIAm controls
- **Disposable SMS**: pluggable adapter, user-supplied provider credentials
- **Storage**: ephemeral by default, scoped to a single test run, no persistence beyond the run lifecycle unless explicitly configured

## Tech Stack (v1)

- **Language/runtime:** TypeScript on Node.js — chosen over Go for the more mature MCP SDK and reference implementations, and because `npx agentiam` matches the install experience developers already expect from MCP servers and CLI dev tools. Go's single-binary/no-runtime-dependency install is a real advantage worth revisiting if install friction turns out to matter more than expected.
- **MCP layer:** `@modelcontextprotocol/sdk`, stdio transport
- **Config validation:** `zod`, parsing YAML (`js-yaml`) — fails loudly with specific errors on a malformed config rather than surfacing as a confusing runtime failure
- **Storage:** SQLite via `better-sqlite3`, stored at `~/.agentiam/agentiam.db` (outside the project repo, so cached tokens are never accidentally committed) — no external database dependency for a self-hosted, single-developer-or-small-team tool
- **Testing:** Vitest
- **Fake data generation (v2):** `@faker-js/faker`, seeded deterministically per run
- **Distribution:** npm package, run via `npx agentiam`

## Folder Structure

```
agentiam/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── .gitignore
├── src/
│   ├── index.ts                  # CLI entrypoint
│   ├── server/
│   │   └── mcpServer.ts          # wires up MCP server + tool routing
│   ├── tools/
│   │   ├── getSession.ts         # v1 — functional
│   │   ├── createIdentity.ts     # v2 — stubbed, not implemented
│   │   ├── readInbox.ts          # v2 — stubbed, not implemented
│   │   └── teardownIdentity.ts   # v3 — stubbed, not implemented
│   ├── config/
│   │   ├── schema.ts             # zod schema for agentiam.config.yaml
│   │   └── loader.ts             # load + validate config, resolve secrets from env
│   ├── auth/
│   │   └── sessionProvider.ts    # cache-or-login logic — the core of v1
│   ├── storage/
│   │   ├── db.ts                 # SQLite connection + lazy migration
│   │   └── migrations/
│   │       └── 001_init.sql      # sessions table (v1 only)
│   └── types/
│       └── index.ts              # shared types across config/auth/tools
├── examples/
│   └── agentiam.config.yaml      # annotated example config
└── test/
    └── getSession.test.ts        # covers cache hit, unknown role, missing secret
```

Design choices behind this layout:
- **`tools/` mirrors the roadmap directly** — v2/v3 files exist as stubs from day one so the tool surface is visible to MCP clients immediately, but they clearly error rather than half-implement. This keeps the "what's real vs. planned" line honest, per the Development Strategy below.
- **`auth/sessionProvider.ts` is deliberately the one file doing real work in v1** — cache lookup, login, cache write. Everything else in v1 is scaffolding around this single piece of logic, which keeps the trust surface for a credentials-handling tool as small as possible.
- **SQLite lives outside the repo (`~/.agentiam/`)**, not in a project-local `.db` file, specifically so a developer can't accidentally commit cached tokens.

## Licensing & Monetization Strategy

**Model: open-core.**
- The MCP server, client logic, and codebase-inference engine are open source. This is the part where trust and auditability matter most (it handles credentials), and it's also the part competitors or platforms (Claude Code, Cursor, MCP registries) could most easily absorb natively — being the open, trusted default is a stronger position than trying to charge for it.
- The hosted infrastructure layer — disposable mail/SMS as a managed service, team dashboards, shared org-level config, audit logging — is the paid product ("AgentIAm Cloud"). This mirrors the precedent set by Mailosaur/MailSlurp, who already sell hosted disposable-inbox infrastructure for testing.

**License: AGPL (or source-available) for the core, not MIT.**
- MIT would let a well-funded competitor fork the code, host it, and out-market the original maintainer without any obligation back.
- AGPL requires anyone offering it as a network service to open-source their modifications. It doesn't stop a fork, but it removes a competitor's ability to build a closed, differentiated hosted product on top of the code — which directly protects the one part of this that's actually monetizable.

**What this strategy does and doesn't solve:**
- It doesn't prevent forking or misuse — no license does. It protects the monetization path specifically, by making it hard for someone else to out-compete on a closed hosted version of the same code.
- Revenue expectation should stay modest and conditional: monetization only becomes real once self-hosting friction (mail deliverability, uptime, credential-adjacent maintenance burden) is proven enough that users choose to pay to avoid it. This should not be assumed at launch.

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Forking / replication | Largely unpreventable — treat as adoption signal, not a threat. Compete on trust (audited, first-mover, actively maintained), hosted infra convenience, and distribution (listed in MCP registries), not on code secrecy. |
| Misuse (repurposed for account-farming on third-party platforms) | Cannot be fully prevented once self-hostable. Mitigate technically: scope disposable-inbox domains so they can't easily receive verification mail from major consumer platforms, hard rate-limits by default, no bundled "known platform" templates. State misuse boundaries explicitly in README/license, not just implicitly. Central control (rate-limiting, monitoring, ability to ban) is only possible on the hosted service — another reason the hosted layer matters beyond revenue. |
| Someone else monetizes the idea first | Lowest priority risk. Trust with credentials is the actual product, not the idea — first-mover advantage as maintainer matters more than the idea being novel. AGPL licensing directly reduces a competitor's ability to build a closed hosted product on the same code. |
| Platform absorption (Claude Code/Cursor/MCP registries build this in natively) | Real and largely outside your control. Best defense is being early, being the de facto default before a platform ships it, and staying narrowly excellent at the identity/auth-fixture problem rather than trying to out-scope a platform. |
| Security scrutiny / CVE burden (credential-adjacent OSS tool) | Expect this as an ongoing cost of the category, not an edge case. Budget real maintenance time; don't treat this as a side project once it has real users touching real credentials. |

## Development Strategy

1. **Build v1 for yourself first.** Solve your own Claude Code auth-token friction across your current client projects before writing any docs aimed at outside users. This is the dogfooding loop that validates whether the pain is real at the scope you think it is.
2. **Ship v1 narrow and boring.** Session provisioning only. No account creation, no mail/SMS infra yet. Smaller trust surface, faster to get right, faster to get real usage signal.
3. **Publish with the non-goals and license rationale stated explicitly** in the README from day one — don't bolt this on after a misuse incident.
4. **Only build v2 (creation) once v1 has real external users**, not just your own projects — codebase-inference is the highest-engineering-risk piece and shouldn't be built speculatively.
5. **Don't build AgentIAm Cloud (hosted infra) until self-hosting friction is a repeated, specific complaint** from real users — not a guess at launch.
6. **Revisit AGPL vs. source-available** once/if there's early signal that a well-resourced competitor is circling — the choice matters most in retrospect, not upfront.

## Open Questions

- How to handle apps that run CAPTCHA even in staging
- Whether project-scoped disposable-mail should be free-tier hosted by the project itself, or fully self-hosted by default at v1
- Exact license choice — AGPL vs. a custom source-available license — pending legal review