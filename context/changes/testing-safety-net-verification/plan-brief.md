# Safety-net Verification — Plan Brief

> Full plan: `context/changes/testing-safety-net-verification/plan.md`
> Research: `context/changes/testing-safety-net-verification/research.md`

## What & Why

This is rollout Phase 1 of `context/foundation/test-plan.md` (risks #3, #1, #5). The project's only safety nets, `smoke.mjs` and `rls-check.mjs`, have shipped a false PASS once already. Research found 11 checks that can pass for the wrong reason, and 3 protected routes with no anonymous test. This phase makes each check fail for the right reason and proves it by breaking things on purpose.

## Starting Point

Both scripts run in CI. Middleware protects pages by a prefix list, and the 2 API write routes have their own auth check. Isolation lives in the database (row-level policies, RPCs that run with the caller's rights). Smoke tests only 2 anonymous GETs, judges B's save attempt on A's row by the response alone, and 3 of its steps check the status code only. 8 RLS checks accept any error.

## Desired End State

Every RLS check asserts an exact error code or row content. One route inventory (`scripts/routes.mjs`) classifies every page file. A unit test fails on any unclassified route, and smoke tests every protected route anonymously. Smoke proves that signed-in pages rendered real content and that A's subscription survived B's attempts. A break catalogue records 11 deliberate breaks, each turning its check red.

## Key Decisions Made

| Decision                 | Choice                                                                                | Why (1 sentence)                                                                            | Source   |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Test layers              | Keep the existing `node:test`, smoke and RLS scripts; no new runner                   | The cheapest layers that already run in CI cover all three risks                            | Research |
| Test runner              | Stay on `node:test`; the `src/` runner (likely Vitest) is chosen in test plan Phase 2 | This phase tests only plain `.mjs` files; switching would add cost with no signal           | Plan     |
| Weak RLS assertions      | Exact error codes, confirmed in a local run first                                     | "Any error" passes on signature drift or a network error, and the codes must not be guessed | Research |
| A unchanged at app layer | Smoke signs back in as A and re-reads the list                                        | Proves persisted state through the real app path with the test's own literals               | Plan     |
| New-route guard          | Route inventory plus a `node:test` that compares it with `src/pages/**`               | A forgotten route fails CI with no server, and the same list drives smoke                   | Plan     |
| Deliberate breaks        | A manual catalogue in the change folder, run once and reverted                        | Covers SQL breaks cheaply and leaves evidence; a harness is too heavy for the signal        | Plan     |
| Remote mode              | Anonymous POST steps run in local mode only                                           | Keeps remote smoke read-only                                                                | Plan     |
| Case-variant probe       | `/Subscriptions` must return 404 or redirect to sign-in                               | Settles research Open Question 1 with one step                                              | Plan     |

## Scope

**In scope:**

- `rls-check.mjs` exact assertions and the same-name category case
- `routes.mjs` and `routes.test.mjs`
- Generated anonymous smoke steps and the case probe
- `rendersList` matcher, body checks and the A re-sign-in
- The break catalogue
- Test plan §6.1/§6.2 and `AGENTS.md`

**Out of scope:**

- Failed-save state checks (risk #2, test plan Phase 2)
- A `src/` test runner
- CI YAML changes
- A scripted break harness
- Server-side session revocation
- Fixing route protection itself (any real hole found becomes a separate change)

## Architecture / Approach

Tighten before breaking. Phases 1–3 change assertions and coverage and must be green on the unbroken app. Phase 4 applies each break alone (a code edit with a rebuild, or a temporary migration with `supabase db reset`), records the FAIL line, and reverts. Phase 5 documents the patterns. Expected values always come from the test's inputs or the risk, never from the code under test.

## Phases at a Glance

| Phase                                   | What it delivers                                                | Key risk                                                               |
| --------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Tighten RLS assertions               | Exact codes, duplicate check removed, same-name category check  | Real codes differ from expected (mitigated: confirm in a run first)    |
| 2. Route inventory + anonymous coverage | `routes.mjs`, inventory test, 5 anonymous steps plus case probe | Astro's Origin check masking anonymous POSTs (the helper sends Origin) |
| 3. Harden smoke                         | `rendersList`, body checks, A re-sign-in                        | Shared cookie jar ordering                                             |
| 4. Break catalogue                      | 11 recorded breaks, all reverted, final green run               | `db reset` wipes local data (ask the user first)                       |
| 5. Cookbook + docs                      | §6.1, §6.2, §6.6, `AGENTS.md`                                   | None significant                                                       |

**Prerequisites:** local Supabase running (Docker); ports 4321/8787 free, or the user's choice of port.
**Estimated effort:** ~2–3 sessions; Phase 4 is the longest (one rebuild or reset per break).

## Open Risks & Assumptions

- The case probe or a new anonymous step may fail on unbroken code. That would be a real security bug: stop and open a separate fix change.
- Expected codes (42501, 23514) are assumptions until the Phase 1 run confirms them.
- The break catalogue is a one-off proof; a later edit can weaken a check without anyone re-running it.

## Success Criteria (Summary)

- Each of the 11 deliberate breaks turns at least one named check red, with the FAIL line recorded.
- A new page or API route that nobody classified fails `npm run test:smoke` in CI.
- All suites are green on the unbroken app, and §6 tells the next slice how to add an access check.
