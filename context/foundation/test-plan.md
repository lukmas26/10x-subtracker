# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-14

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`, `scripts/` (excluding `dist/`, `node_modules/`, `context/`, `.claude/`, generated `src/db/database.types.ts`). 25 commits in the last 30 days (scan date 2026-10-14).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                   | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A signed-in user reads, opens for edit, or saves another account's subscription or private category (e.g. by swapping an id in the URL or request body)                   | High   | High       | PRD Success Criteria → Guardrails + NFR (financial data privacy); roadmap S-01 Risk; interview Q1, Q3; roadmap S-03/S-06 add new write paths                                                  |
| 2   | A failed or interrupted edit save changes or wipes an existing subscription                                                                                               | High   | High       | PRD Guardrails (no data loss) + NFR (write error must not erase data); roadmap S-02 Risk, S-03 Risk; `lessons.md` (multi-table writes are not atomic); interview Q1                           |
| 3   | The safety net (`smoke`, `test:rls`) reports PASS while the behaviour it claims to protect is broken                                                                      | High   | High       | archive `2026-09-30-safe-release-verification` (a false PASS already shipped once); interview Q4 (smoke was AI-generated, coverage unverified); hot-spot dir `scripts/` — 25 file changes/30d |
| 4   | The user sees a "saved/updated" confirmation although nothing was persisted, or the subscription lands in a wrong or duplicated category                                  | High   | Medium     | PRD NFR (fast action confirmation); archive `2026-10-02-first-subscription-on-list` (category reuse rule); interview Q4; hot-spot dir `src/lib/` — 8 commits/30d                              |
| 5   | An anonymous visitor reaches a protected page or API route, e.g. a route added by a later slice                                                                           | High   | Medium     | `AGENTS.md` Auth flow (protection by path-prefix list); hot-spot dirs `src/pages/api/` — 4 commits/30d, middleware — 3 commits/30d; every roadmap slice adds routes                           |
| 6   | Validation and permission rules drift between form, server, and database (currency, amount, category, another user's category), or the server trusts what the client sent | Medium | High       | interview Q3; PRD FR-002; hot-spot dirs `src/components/form/` — 11, `supabase/migrations/` — 3 commits/30d                                                                                   |
| 7   | The spending summary shows misleading totals: yearly amounts not normalized, or different currencies summed together                                                      | High   | Medium     | PRD FR-006 (Socrates note on cycle normalization); roadmap S-04 Risk; becomes live when S-04 ships                                                                                            |

Abuse rows: #1 (IDOR / ownership), #5 (unauthenticated access), #6 (untrusted input). A Supabase or Cloudflare outage is High impact × Low likelihood and belongs to observability, not to a test.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                   | Must challenge                                                           | Context `/10x-research` must ground                                                    | Likely cheapest layer                              | Anti-pattern to avoid                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| #1   | Account B is denied on every path — list, edit page, save, RPC, direct REST write — and A's data is unchanged afterwards                      | "RLS exists, so the app is sealed"; "smoke is green, so isolation works" | every read/write entry point, per-operation policies, session/client shape per request | integration (REST, two accounts)                   | asserting only the list view; single-account tests                                       |
| #2   | After a forced failure (invalid amount, new category name, dropped connection) the stored row is identical and no category was created        | "a 302 back to the form means nothing happened"                          | transaction boundary of each write, error translation path                             | integration on local Supabase                      | asserting only the redirect, never re-reading persisted state                            |
| #3   | Every smoke step and RLS check fails when its protected behaviour is deliberately broken                                                      | "PASS means covered"; "step name equals what the step asserts"           | map of step → assertion → what actually breaks it                                      | deliberate-break runs + matcher unit tests         | a check that cannot fail; expected value lifted from the implementation (oracle problem) |
| #4   | Success feedback appears only when the row really exists; an existing category typed with different case/whitespace is reused, not duplicated | "no exception means saved"                                               | error path from service to UI, category name comparison rule                           | service integration                                | mocking the database client so every call succeeds                                       |
| #5   | Every protected page and endpoint rejects anonymous requests; a new route cannot skip protection without a red test                           | "dashboard redirects, so everything is protected"                        | full route list vs protected-prefix list                                               | integration / smoke over the route list            | testing one example route                                                                |
| #6   | One shared case table (valid and boundary inputs) yields the same verdict in form, server, and database                                       | "client validation is enough"                                            | where each rule lives in each layer                                                    | table-driven unit + integration for DB constraints | re-implementing the rule inside the test instead of sourcing cases from the PRD          |
| #7   | Hand-computed PRD examples hold: 120 PLN yearly = 10 PLN monthly; PLN and USD give two separate totals                                        | "one matching example proves the sum"                                    | normalization, rounding, per-currency grouping                                         | unit                                               | expected values computed by the code under test                                          |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name              | Goal (one line)                                                                                                                 | Risks covered | Test types                                       | Status        | Change folder                   |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------ | ------------- | ------------------------------- |
| 1   | Safety-net verification | Prove the existing smoke and RLS checks really catch leaks, data loss, and unauthenticated access; close the route-coverage gap | #3, #1, #5    | deliberate-break runs, integration (REST), smoke | change opened | testing-safety-net-verification |
| 2   | Service logic coverage  | Bootstrap a runner for service code; prove atomic writes, honest error feedback, category reuse, and one rule set across layers | #2, #4, #6    | unit + integration (local Supabase)              | not started   | —                               |
| 3   | Summary math oracle     | Prove summary totals against hand-computed PRD examples; starts after roadmap S-04 ships                                        | #7            | unit                                             | not started   | —                               |
| 4   | Quality-gates wiring    | Make unit + integration a required CI step; add a local post-edit hook on service and migration edits                           | cross-cutting | CI gates, post-edit hook                         | not started   | —                               |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.

Test-base profile: **sparse** — no test-runner config; 2 `node:test` files, both for script matchers (`scripts/*.test.mjs`); script-based e2e smoke and RLS check; zero tests under `src/`.

| Layer                       | Tool                                              | Version | Notes                                                                                                  |
| --------------------------- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| unit (scripts)              | `node:test` + `node:assert/strict`                | Node 22 | `npm run test:smoke`; covers matchers only                                                             |
| unit + integration (`src/`) | none yet — see Phase 2                            | —       | runner choice made in Phase 2 research (must run in Node against Astro/TS code)                        |
| RLS / data isolation        | `scripts/rls-check.mjs` (Supabase REST, anon key) | —       | `npm run test:rls`, local Supabase only                                                                |
| e2e                         | `scripts/smoke.mjs` (dependency-free HTTP)        | —       | `npm run smoke` local/CI; `smoke:remote` read-only on hosted                                           |
| accessibility               | `eslint-plugin-jsx-a11y`                          | 6.10.2  | static lint only                                                                                       |
| UI tokens                   | `scripts/ui-literals-check.mjs`                   | —       | `npm run lint:ui`                                                                                      |
| (optional) AI-native        | Claude Code post-edit hook — checked: 2026-10-14  | n/a     | Phase 4. When NOT to use: as a substitute for the CI gate, or for slow suites needing a running server |

**Stack grounding tools (current session):**

- Docs: none (no Context7 or framework docs MCP) — stack read from `package.json`, `tech-stack.md`, CI; checked: 2026-10-14
- Search: WebSearch/WebFetch (no Exa.ai) — not used; checked: 2026-10-14
- Runtime/browser: claude-in-chrome — possible exploratory two-account check; not used; checked: 2026-10-14
- Provider/platform: none (no GitHub/Supabase/Cloudflare MCP) — not used; checked: 2026-10-14

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                                  | Where                         | Required?                    | Catches                                |
| ----------------------------------------------------- | ----------------------------- | ---------------------------- | -------------------------------------- |
| lint + typecheck (`lint`, `astro check`)              | pre-commit + CI               | required                     | syntactic / type drift                 |
| UI literals (`lint:ui`)                               | pre-commit + CI               | required                     | design-token drift                     |
| format (`format:check`)                               | pre-commit (lint-staged) + CI | required                     | formatting drift                       |
| dependency audit (`npm audit --audit-level=critical`) | CI                            | required                     | critical advisories                    |
| script matcher tests (`test:smoke`)                   | CI                            | required                     | smoke matcher regressions              |
| DB types match migrations                             | CI                            | required                     | schema / type drift                    |
| RLS check (`test:rls`)                                | CI (local Supabase)           | required                     | cross-account access (#1)              |
| smoke on production build                             | CI                            | required                     | broken auth, add/edit, isolation flows |
| unit + integration for services                       | local + CI                    | required after §3 Phase 4    | logic regressions (#2, #4, #6, #7)     |
| post-edit hook                                        | local (agent loop)            | recommended after §3 Phase 4 | regressions at edit time               |
| pre-prod smoke (`smoke:remote`)                       | preview, then production      | required per release runbook | environment-specific failures          |

The CI jobs `ci` and `smoke` are required status checks on `master`, enforced by the ruleset in `.github/rulesets/master.json`.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding an access-control check (new table, route, or write path)

- TBD — see §3 Phase 1 for the two-account denial pattern and deliberate-break proof.

### 6.2 Adding a smoke step that can actually fail

- TBD — see §3 Phase 1 for the step → assertion → deliberate-break pattern.

### 6.3 Adding a service integration test

- TBD — see §3 Phase 2 for the failed-write-leaves-state-unchanged and honest-confirmation pattern.

### 6.4 Adding a validation rule across form, server, and database

- TBD — see §3 Phase 2 for the shared case-table pattern.

### 6.5 Adding a calculation test with an independent oracle

- TBD — see §3 Phase 3 for the hand-computed-example pattern.

### 6.6 Per-rollout-phase notes

(Appended by each phase after it lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **`/dev/kitchen-sink`** — dev-only state preview, never served in production. Re-evaluate if it ships to users. (Source: Phase 2 interview Q5.)
- **Generated `src/db/database.types.ts`** — the generator is the test; CI already diffs it against the migrations. Re-evaluate if the CI diff step is removed. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-14
- Stack versions last verified: 2026-10-14
- AI-native tool references last verified: 2026-10-14

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
