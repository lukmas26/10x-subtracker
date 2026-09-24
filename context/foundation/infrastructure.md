---
project: SubTracker
researched_at: 2026-09-23
recommended_platform: Cloudflare Workers
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript 6
  framework: Astro 7.3 (output "server", React 19 islands, Tailwind 4)
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare 14.3
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers passes all five agent-friendly criteria and is the only candidate that requires
zero migration: `@astrojs/cloudflare` 14.3 and a populated `wrangler.jsonc` are already on disk, so
the first deploy is a `wrangler deploy` rather than an adapter swap. Against a one-week MVP budget
and a hard 2026-11-04 deadline in after-hours time, that head start outweighs Render's simpler
persistent-connection story. The interview's soft weights were deliberately neutral here — single
region means Cloudflare's edge footprint earns nothing, and external providers (Supabase,
OpenRouter) mean its co-located databases earn nothing either — so the decision rests on criteria
scores, migration cost, and the fact that every persistent-work primitive Cloudflare offers
(Durable Objects, Queues, Cron Triggers, Workflows) is GA rather than beta.

### Inputs that shaped this decision

| Input | Value | Effect |
|---|---|---|
| Persistent connections required | **Yes** | Hard filter — dropped Netlify; penalized Vercel |
| Cost vs. DX | Roughly equal | Neutral — no penalty applied to any tier |
| Platform familiarity | None | No tie-breaker available |
| Geographic reach | Single region | **Edge-native bonus not applied** (removes a Cloudflare advantage) |
| Service co-location | External (Supabase + OpenRouter) | **Co-location bonus not applied** to any platform |
| PRD scale | small users / low QPS / small data | All candidates sit inside free or near-free tiers |
| PRD deadline | 2026-11-04, after-hours only, 1-week MVP | Migration cost weighted heavily |

### Contract drift found during research

Three recorded facts no longer hold. They are corrected here and should be reconciled upstream:

1. **`tech-stack.md` says `deployment_target: cloudflare-pages`. This is not achievable.**
   `@astrojs/cloudflare` v13.0.0 dropped official Pages support in favour of Workers, and the
   project pins v14.3. `wrangler deploy` and `wrangler pages deploy` are **not interchangeable** —
   different config and binding models. The Workers path is the only supported one.
2. **`tech-stack.md` says `has_realtime: false` and `has_background_jobs: false`; the interview
   answered "Yes" to persistent connections.** The interview answer was treated as the live
   constraint. This contradiction is the single input that most damages Cloudflare's ranking (see
   the risk register) and is worth resolving before the first architectural commitment.
3. **`tech-stack.md` says `has_ai: false`; OpenRouter is now planned.** LLM streaming is I/O-bound
   and suits Workers, but it interacts with CPU-time limits — captured as a risk below.

## Platform Comparison

Hard filters applied before scoring: a platform that cannot hold a persistent connection is
dropped; a platform that cannot run the stack's runtime is dropped.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / integration | Result |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5 Pass — recommended** |
| **Render** | Pass | Pass | Pass | Pass | Pass | **5 Pass — runner-up** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | 4 Pass / 1 Partial |
| **Fly.io** | Pass | Partial | Pass | Pass | Partial | 3 Pass / 2 Partial |
| **Railway** | Partial | Pass | Pass | Partial | Partial | 2 Pass / 3 Partial |
| ~~Netlify~~ | — | — | — | — | — | **Filtered out** |

### Per-platform notes

**Cloudflare Workers.** `wrangler` 4.131 covers the full loop: `deploy`, `versions upload` (preview
URL without publishing), `versions deploy <id>@N%` (gradual rollout), `rollback`, `tail`,
`secret put`. Fully serverless — no OS, no container, no health checks to tune. Docs publish
`llms.txt`, `llms-full.txt` and per-product scoped corpora (`/workers/llms-full.txt`) with Markdown
source on GitHub — the strongest agent-docs story of the six. Thirteen first-party MCP servers
exist, though per-server GA/beta maturity is mixed and was not confirmable from a single status
page. Free plan is 100k requests/**day**, which dwarfs this PRD's entire projected load; the
$5/mo Paid plan buys CPU headroom and persistent-connection primitives, not capacity.

**Render (runner-up).** Ties Cloudflare at 5 Pass and has the simpler persistent-connection story:
a Background Worker or always-on web service is an ordinary long-lived Node process, and WebSockets
are GA with zero extra configuration. Official CLI v2.28 covers deploys, live logs, `ssh`, `psql`
and non-interactive CI mode; a full OpenAPI 3.0 REST API and deploy hooks back it up; docs serve
`.md` twins and `llms.txt`; the first-party MCP server is GA and ships an agent-skills catalog with
a Claude Code plugin. Frankfurt covers EU. Loses on cost of change: requires swapping to
`@astrojs/node` standalone, and the free tier spins down after 15 minutes (30–60s cold start), so
a persistent-connection app needs the $7/mo Starter tier. No official GitHub Action.

**Vercel.** Strong CLI (`deploy`, `rollback`, `promote`, `logs`, `env`) and excellent agent docs
(`llms.txt` plus Markdown content negotiation). Three things cost it the shortlist: the Hobby plan
is **non-commercial only**, making $20/mo Pro the real floor; WebSocket support is labelled Public
Beta with no guaranteed reconnection to the same instance; and Vercel MCP is Public Beta. Note the
adapter constraint if ever revisited: `@astrojs/vercel` **v11+** is required for Astro 7 — the
common v10 line pins to Astro ^6 and will fail peer resolution.

**Fly.io.** Cheapest always-on option (~$2.19/mo for shared-cpu-1x/256MB) with native, fully
supported WebSockets and a complete `flyctl`. Scores Partial on managed/serverless because you own
a Dockerfile (auto-generated by `fly launch` via `@flydotio/dockerfile`, but yours to maintain),
health-check grace periods, and cold-start tuning — Node cold starts measured at ~380–620ms under
`auto_stop_machines`. Partial on MCP: a first-party `fly mcp` is documented but carries no explicit
GA marker. Free allowances were removed for new orgs in October 2024 — a credit card is required.
Rollback is a two-step `fly releases` → `fly deploy --image <digest>` sequence that does **not**
restore secrets or config.

**Railway.** The weakest fit despite good docs. Railpack (default builder since 2026-03-04)
explicitly excludes Astro apps with `output: "server"` from its zero-config Astro provider, so a
hand-maintained Dockerfile is effectively required. Rollback is a dashboard action with no CLI
equivalent, and PR environments are dashboard-enabled — both puncture the CLI-first criterion. No
official first-party deploy GitHub Action. Its MCP moved into the CLI (`railway mcp`) in
April 2026, archiving the standalone server — actively evolving rather than hardened. App Sleeping
is documented as a "bad fit" for persistent connections, so always-on pricing (~$8–15/mo) applies.

**Netlify — filtered out.** WebSockets are not supported at all: no first-party product, not a tier
gate. Background Functions are request-triggered with a 15-minute cap, and Scheduled Functions cap
at 30s. This is an architectural mismatch with the stated persistent-connection requirement, so it
was dropped before scoring. Worth noting what was forfeited: a mature official MCP server and a GA
Netlify DB. Also relevant if the requirement is ever relaxed — sync function timeouts are 10s on
Free/Personal and 26s on Pro, which would truncate long OpenRouter generations.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wins on the intersection of criteria score and cost of change. The repository is already
Workers-shaped: `wrangler.jsonc` declares `main: "@astrojs/cloudflare/entrypoints/server"`, an
`assets` binding, `nodejs_compat`, and `observability.enabled`. Every persistent-work primitive is
GA — Durable Objects with WebSocket Hibernation, Queues (free-plan-eligible since 2026-02-04),
Cron Triggers, Workflows. Best-in-class agent-readable documentation. At this PRD's scale the cost
is $0–5/mo.

#### 2. Render

Equal on criteria, better on architectural simplicity for persistent connections, worse on cost of
change and price floor. This is the swap target if the Durable Objects commitment proves too
expensive against the deadline — the migration is `npx astro add node` (standalone mode),
`HOST=0.0.0.0`, start command `node dist/server/entry.mjs`, region Frankfurt.

#### 3. Fly.io

The fallback if cost becomes the binding constraint or if the app needs a genuinely long-lived
process with full Node semantics. Accept in exchange: a Dockerfile you maintain, cold-start tuning,
and a rollback procedure that restores images but not configuration.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Persistent connections on Workers is not a setting, it is a rewrite.** Workers has no
   long-lived process. Holding a WebSocket means adopting Durable Objects — a separate class,
   binding, billing line and mental model. Render and Fly deliver the same capability with an
   ordinary WebSocket server. Against a one-week after-hours budget, that gap is decisive.
2. **The recorded `cloudflare-pages` target is dead on arrival.** Adapter v13 dropped Pages; the
   project pins v14.3. Any tutorial, agent memory, or deploy plan reaching for
   `wrangler pages deploy` produces a confidently broken deploy.
3. **CPU limits bite exactly where OpenRouter lives.** The free tier allows 10ms CPU per
   invocation. Streaming is mostly I/O wait so it may survive, but any token post-processing forces
   the $5 Paid plan, and the default 30s CPU ceiling constrains long generations.
4. **Supabase on workerd is the least-trodden path of the five candidates.** `@supabase/ssr` runs
   against `nodejs_compat` shims, not Node. `scripts/smoke.mjs` runs against a Node fetch client and
   will not catch a workerd-only failure in cookie handling or the SSR client.
5. **Rollback reverts code, not schema.** `wrangler rollback` restores a Worker version; a Supabase
   migration that altered a column stays altered. For RLS-protected financial data, a
   half-rolled-back state is worse than an outage.

### Pre-Mortem — How This Could Fail

It is March 2027 and SubTracker never shipped. The first week went well: `wrangler deploy` worked on
day one because the scaffold was already Workers-shaped, and the CRUD screens landed. Then the
duplicate-category recommendation got an LLM upgrade and OpenRouter streaming went in. It worked
locally under `astro dev` on workerd, but production responses truncated intermittently under CPU
accounting, and the failures were invisible in `wrangler tail` because they looked like client
disconnects. Two after-hours weeks vanished into that. The fix pointed at Durable Objects, so a
"quick" refactor began: session state moved into a DO, the DO's storage semantics did not match what
the Supabase-backed auth flow assumed, and `context.locals.user` stopped being reliable across the
hibernation boundary. Meanwhile the smoke test still passed, because it had never exercised workerd.
By the time the architecture settled the hard deadline was gone, and the honest retrospective was
that the platform was chosen because the scaffold already pointed there — not because anyone checked
whether Workers suited an app that had just acquired persistent connections.

### Unknown Unknowns

- **`astro dev` already runs on workerd** with adapter v13+, so `wrangler dev` is no longer the
  runtime-fidelity story — but it *is* still needed to exercise Durable Object, KV and D1 bindings
  the plain dev server does not expose. Tutorials and agents get this wrong in both directions.
- **`nodejs_compat` becomes default-on only at compatibility date ≥ 2026-08-04.** This project's
  date is `2026-05-08`, so the explicit flag in `wrangler.jsonc` is load-bearing. Removing it as
  "redundant" silently breaks the build.
- **Adapter v13 was a breaking-change cliff that the current `AGENTS.md` partially predates.**
  `Astro.locals.runtime.env` is gone (now `env` from `cloudflare:workers`), `runtime.cf` moved to
  `Astro.request.cf`, `runtime.caches` to the global `caches`, `Astro.locals.runtime` to
  `Astro.locals.cfContext`, and the default image service changed `compile` → `cloudflare-binding`.
  Code written from pre-v13 knowledge typechecks and fails at runtime.
- **Hyperdrive is free and GA and this project probably does not need it.** Supabase already pools
  via Supavisor, and single-region deployment removes the latency argument. Every Cloudflare+Postgres
  guide will still push it, adding a binding to reason about for a benefit you do not have.
- **Workers Free is 100k requests per *day*, not per month** — roughly two orders of magnitude above
  this PRD's projected load. The $5/mo buys CPU headroom and persistent-connection primitives, not
  capacity. If the persistent-connection requirement turns out to be aspirational, Cloudflare's cost
  case strengthens rather than weakens.

## Operational Story

- **Preview deploys**: `wrangler versions upload` uploads a version and returns a preview URL
  *without* routing production traffic to it; promote with `wrangler versions deploy <version-id>`,
  optionally as a percentage rollout (`<id>@10%`). Preview URLs are public by default — put
  Cloudflare Access in front of them before any preview touches real Supabase data, since SubTracker
  previews will render financial records.
- **Secrets**: `SUPABASE_URL` and `SUPABASE_KEY` (and later `OPENROUTER_API_KEY`) live in Workers
  Secrets via `wrangler secret put <NAME>`, write-only once set — readable by Cloudflare account
  members with Workers access, never by the agent. Locally they live in `.dev.vars` (gitignored);
  CI reads them from GitHub Actions repo secrets. Every new variable must also be declared in
  `env.schema` in `astro.config.mjs` or `astro:env/server` will not expose it. Rotation is
  `wrangler secret put` followed by a redeploy; rotating the Supabase key is a human-only action.
- **Rollback**: `wrangler rollback` reverts to the previous version, or
  `wrangler rollback <version-id>` to a named one; time-to-revert is under a minute and requires no
  rebuild. **Caveat: this rolls back the Worker only.** Supabase migrations do not roll back with
  it, so any deploy carrying a schema change needs a matching down-migration prepared before the
  deploy, not after the incident.
- **Approval**: the agent may run `wrangler deploy` to a preview version, `wrangler versions upload`,
  `wrangler tail`, and read-only inspection commands unattended. Human-only: promoting a version to
  100% production traffic, `wrangler secret put` for any production secret, rotating the Supabase
  service key, dropping or truncating any Supabase table, and deleting the Worker or project. A
  manual click costs thirty seconds; cleanup after an automated mistake on financial data costs
  hours.
- **Logs**: `wrangler tail` streams live runtime logs; `wrangler tail --format json` gives
  structured output for parsing; `observability.enabled` is already true in `wrangler.jsonc`, so
  invocation logs persist and are queryable in the dashboard. CI logs come from
  `gh run view --log`. Cloudflare's observability MCP server is an option later if log
  querying becomes a recurring pattern — start with the CLI.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Persistent-connection requirement forces a Durable Objects rewrite mid-build | Devil's advocate | M | H | Resolve the `has_realtime` contradiction before the first architectural commitment; if WebSockets are genuinely needed, swap to Render (runner-up) rather than absorbing a DO refactor under deadline |
| Deploy plan or agent reaches for `wrangler pages deploy` | Devil's advocate | H | M | Record in `AGENTS.md` and the deploy plan that Workers is the only supported path on adapter v14; the Pages command must never appear in a script |
| OpenRouter streaming truncates under Workers CPU accounting | Devil's advocate / Unknown unknowns | M | H | Move to the $5 Paid plan before the first LLM feature; raise the CPU limit from the 30s default; add an explicit streaming-completion assertion to `scripts/smoke.mjs` |
| `scripts/smoke.mjs` passes on Node but the app fails on workerd | Devil's advocate | M | H | Run the smoke test against `astro dev` (which now runs on workerd) and against a deployed preview URL, not only a Node server |
| Supabase migration cannot be rolled back with `wrangler rollback` | Devil's advocate | M | H | Require a prepared down-migration for any deploy carrying schema changes; never bundle a schema change with a risky code change |
| `nodejs_compat` flag removed as "redundant" | Unknown unknowns | L | H | Comment the flag in `wrangler.jsonc` noting it is required below compatibility date 2026-08-04 |
| Agent writes adapter v12-era APIs (`Astro.locals.runtime.env`) that typecheck but fail at runtime | Unknown unknowns | H | M | Add the v13 breaking-change list to `AGENTS.md`; `npx astro check` plus a preview deploy before promotion |
| Preview URLs expose real financial data publicly | Research finding | M | H | Put Cloudflare Access in front of preview URLs, or point previews at a separate Supabase project |
| Hyperdrive added on guide advice without need | Unknown unknowns | M | L | Single-region + Supavisor pooling means it is not required for MVP; revisit only if Worker→Postgres latency is measured and material |
| Cloudflare MCP servers assumed GA when maturity is mixed | Research finding | M | L | Start CLI-only; check per-server status before adding any MCP server to the context window |
| Tech-stack contract stays out of sync with reality | Research finding | H | M | Re-run `/10x-tech-stack-selector` or hand-patch `tech-stack.md` to `deployment_target: cloudflare-workers` and correct `has_realtime` / `has_ai` |

## Getting Started

Commands validated against this project's pinned versions (`@astrojs/cloudflare` 14.3,
`wrangler` 4.131, Astro 7.3) — not against general platform documentation.

1. **Authenticate and confirm the account.** `npx wrangler login`, then `npx wrangler whoami`.
   Create a scoped API token (Workers Scripts edit for this project only — no DNS, no billing, no
   unrelated Workers Secrets) and keep it in an environment variable, never in a committed file.
2. **Build and verify locally on the real runtime.** `npm run build`, then `npm run preview`.
   With adapter v14 this already runs on workerd — do **not** add `wrangler dev` or
   `wrangler pages dev` to the workflow for base runtime fidelity; it is only needed later if you
   add Durable Object, KV or D1 bindings.
3. **Set production secrets before the first deploy.**
   `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`. Both are
   declared `optional` in `env.schema`, so a deploy without them succeeds and the app degrades via
   `src/lib/config-status.ts` — verify deliberately rather than assuming the deploy proved them
   present.
4. **Upload a version without publishing, and check it.** `npx wrangler versions upload` returns a
   preview URL. Run `npm run smoke` with `BASE_URL` pointed at that URL to exercise the auth flow on
   workerd against real Supabase.
5. **Promote to production, then watch.** `npx wrangler deploy` (or
   `npx wrangler versions deploy <version-id>` for a gradual rollout), then `npx wrangler tail` to
   confirm live traffic. Keep `npx wrangler rollback` one command away.
6. **Reconcile the contract.** Update `tech-stack.md` to `deployment_target: cloudflare-workers` so
   the recorded stack matches what actually ships.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration and Dockerfile authoring
- CI/CD pipeline setup (`.github/workflows/ci.yml` already exists and was not modified)
- Production-scale architecture — multi-region, HA, disaster recovery
- The Durable Objects data model itself, should the persistent-connection requirement be confirmed
