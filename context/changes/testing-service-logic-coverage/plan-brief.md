# Test plan Phase 2 — Service logic coverage — Plan Brief

> Full plan: `context/changes/testing-service-logic-coverage/plan.md`
> Research: `context/changes/testing-service-logic-coverage/research.md`

## What & Why

Phase 2 of the test plan covers three risks:

- **#2** — a failed save changes or wipes a subscription;
- **#4** — the user sees "saved/updated" although nothing was persisted, or a category is duplicated;
- **#6** — the form, server and database disagree on what is valid.

Today `src/` has no tests and no runner. These guarantees rest on code comments, the database-level checks in `test:rls`, and smoke's happy path.

## Starting Point

- **Writes.** Each one is already one atomic RPC call. `test:rls` proves rollback for one forced failure (amount 0 plus a new category).
- **Not tested yet:**
  - the service and route error translation;
  - the redirect contract, which decides whether the success banner shows;
  - category reuse by case or outer spaces;
  - agreement between the three copies of the validation rules.

## Desired End State

- **`npm test`** runs the unit suite with no services.
- **`npm run test:integration`** runs against local Supabase and fails loudly without it.
- **What the tests prove:**
  - one sourced case table gives the same verdict in the form validator, the server parser and the database, with every known divergence documented;
  - every save path re-reads the stored row after success and failure;
  - category reuse is pinned through both RPCs.
- **Breaks.** Every test was broken on purpose once (red), then reverted.

## Key Decisions Made

| Decision                    | Choice                                                                         | Why (1 sentence)                                                                                     | Source   |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| Form verdicts               | Extract a pure `validateSubscriptionForm`; no component rendering              | Testable with the same table as the parser and no jsdom/Testing Library                               | Research |
| Crafted `?saved=1`          | Out of Phase 2; follow-up for a separate change                                | It is a code fix, not a test; this phase proves the server-side path is honest                        | Research |
| Category whitespace         | Keep case + outer-space normalisation; pin inner double space as a new category | No migration; a future rule change shows up as a red test                                             | Research |
| Lost response → duplicate   | Known gap; idempotency-key follow-up                                           | Not testable locally without a proxy; the impact is visible and recoverable                           | Research |
| Runner                      | Vitest 5 via Astro `getViteConfig`; `scripts/` stay on `node:test`             | Resolves the `@/` alias and `astro:*`; Vite 8 peer range fits Astro 7                                  | Research |
| Supabase missing            | Separate `test:integration` that fails when env is missing or not local        | No silent green, matching the "no vacuous pass" rule                                                  | Plan     |
| Feedback test layer         | Service + `POST` handlers with a fake context, re-reading rows                 | Covers result → redirect → banner without a running server                                            | Plan     |
| DB layer of case table      | Call `create_subscription` directly with raw values; assert exact codes        | Proves the DB constraints themselves, on the real write path                                          | Plan     |

## Scope

**In scope:**

- Vitest 5 bootstrap with `unit`/`integration` projects and a local-only guard
- The extracted form validator
- The case table
- Service, route and category-reuse integration tests
- Deliberate breaks
- Test-plan cookbook §6.3/§6.4, `AGENTS.md` commands, the `lessons.md` anchor fix and `follow-ups.md`

**Out of scope:**

- CI and hook wiring (test-plan Phase 4)
- The `?saved=1` fix and the idempotency key (separate changes)
- Inner-whitespace normalisation
- Component rendering
- Middleware tests
- Hosted Supabase
- Re-testing what `test:rls` already proves

## Architecture / Approach

Tests live in a top-level `tests/` directory (`unit/`, `integration/`, `helpers/`, `cases/`). They must never be under `src/pages/`, where the route inventory would flag them.

Integration tests inject a real signed-in `SupabaseClient` into the service functions and route handlers, which already take the client as a parameter or read it from `locals`. They snapshot the state, act, and re-read with a healthy client. The database is never mocked.

The case table is the single oracle. Expected verdicts and error codes come from the PRD, the S-01 plan, the roadmap and the migrations.

## Phases at a Glance

| Phase                               | What it delivers                                                                    | Key risk                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Runner bootstrap                 | Vitest 5 + `getViteConfig`, two projects, guard, helpers, probe tests               | Vitest 5 with Astro 7 is unverified; fallback to 4.x needs your approval  |
| 2. One rule set (#6)                | Pure validator, sourced case table, unit + RPC verdicts                             | The extraction changes form messages (guarded by a manual check)          |
| 3. Atomic writes & feedback (#2,#4) | Service + route integration with exact redirects and re-reads                       | The fake context drifts from Astro's `APIContext` shape                   |
| 4. Category reuse (#4)              | Case, outer-space and Polish reuse; inner-space boundary; both RPCs                 | The locale may differ outside local Supabase                              |
| 5. Prove & document                 | 7 deliberate breaks, break catalogue, cookbook, `AGENTS.md`, lessons fix, follow-ups | Forgetting to revert a DB function break                                  |

**Prerequisites:** local Supabase running (it is), with the port check done before each run; `npm ci`.
**Estimated effort:** about 3–4 sessions across 5 phases.

## Open Risks & Assumptions

- **Vitest 5 + `getViteConfig`.** If it fails, implementation stops for your decision.
- **DB error codes** (`23514`, `22003`, `22P02`, `23502`) are derived from the schema. A different code at runtime triggers the oracle rule (investigate, never re-fit).
- **Polish case folding** is verified locally only (ICU `en_US.UTF-8`).

## Success Criteria (Summary)

- A contributor runs `npm test` with no services, and `npm run test:integration` against local Supabase, and both are green.
- The `break-catalogue.md` shows each new test red under a deliberate break and green after the revert.
- The next validation rule or write path can be added by following test-plan §6.3/§6.4.
