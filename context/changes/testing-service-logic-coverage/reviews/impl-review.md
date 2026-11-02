<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Test plan Phase 2 — Service logic coverage

- **Plan**: context/changes/testing-service-logic-coverage/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Notes: every planned change is present (no MISSING). The accepted deviations made during implementation are documented in the conversation, `break-catalogue.md` and the case table: the Cloudflare plugin filter and env restore in `vitest.config.ts`, `global-setup.ts`, `category-none` → `42501`, `NEW_CATEGORY` moved, the `amount-missing` row, few sign-ups per file, and "Photo storage". "What We're NOT Doing" is respected: no CI or hook wiring, no banner fix, no migration, no rendering dependencies, no middleware tests, hosted Supabase blocked. Success criteria re-run on HEAD: `npm test` 44/44, `npm run test:integration` 57/57, and no credentials → exit 1. Lint, `astro check`, `format:check`, build, `test:smoke` and `test:rls` were green on `9ec20db`; the epilogue changed only markdown. Manual rows 1.5, 2.4, 2.5, 5.4 and 5.5 were confirmed by the user in-session.

## Findings

### F1 — Local-only guard runs only in the integration globalSetup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/helpers/supabase.ts:43
- **Detail**: `assertLocalSupabase()` runs only through `tests/helpers/global-setup.ts`, which is wired to the `integration` project only. `newClient()` and `signUpUser()` do not check the host. A future `tests/unit/*.test.ts` that calls `signUpUser` would sign up users against whatever `SUPABASE_URL` the shell holds, hosted included, with no guard. Today no unit test builds a client.
- **Fix**: Call `assertLocalSupabase()` at the start of `newClient()`, so every path that builds a client is guarded.
- **Decision**: FIXED — `assertLocalSupabase()` now runs at the start of `newClient()`

### F2 — "Row unchanged" checks do not assert the before-read found the row

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/subscriptions.service.test.ts:206,223,240; tests/integration/subscriptions.routes.test.ts:210,251,265
- **Detail**: `getSubscription` returns `null` when the row is not visible (it throws on a query error). If the seeded row were invisible to the before-read, `expect(after).toEqual(before)` would compare `null` with `null` and pass. This is unlikely, because `seed()` just created the row, but nothing asserts it.
- **Fix**: Add `expect(before).not.toBeNull()` after each before-read.
- **Decision**: FIXED — `expect(before).not.toBeNull()` added after all 6 before-reads

### F3 — Parser accept rows don't check categoryId, currency or cycle

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/unit/subscription-rules.test.ts (parser `it.each`, accepted branch)
- **Detail**: Accepted rows assert `name`, `amount` and `newCategory` against `row.stored`, but not `categoryId`, `currency` or `cycle`. A parser that dropped `categoryId` on the existing-category path would still pass the unit layer. The integration layer covers it partly, but only through the raw RPC, not the parser.
- **Fix**: Also assert `currency`, `cycle` and `categoryId` from the row input on the accepted branch.
- **Decision**: FIXED — accepted parser rows now also assert `currency`, `cycle` and `categoryId` (null for a new category)

### F4 — Reject branch could compare undefined codes

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/subscription-rules.db.test.ts (reject branch, `expect(error?.code).toBe(row.db?.code)`)
- **Detail**: Every current reject row has a `db.code`. A future reject row added without one would compare `undefined` with `undefined` on the code check. `data === null` and the snapshot comparison would still apply.
- **Fix**: Assert `row.db?.code` is defined on the reject branch.
- **Decision**: FIXED — reject branch now asserts `row.db?.code` is defined before comparing

### F5 — Case-table sources cited per group, not per row

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/cases/subscription-cases.ts:75,117-118,181,197,217,228-229
- **Detail**: The plan says "each row cites its source". Sources are given once per field group in a comment, and again in `db.reason` on reject and divergence rows. The six plain accept rows rely on the group comment. `amount-text` cites "p_amount numeric" without a file:line. The cookbook this change wrote (test-plan §6.4) documents the per-group comment as the convention.
- **Fix**: Add the migration line to `amount-text`'s reason; keep per-group citations as the documented convention.
- **Decision**: FIXED — `amount-text` now cites `20261003140000_create_subscription_rpc.sql:10`; per-group citations kept (test-plan §6.4)

### F6 — Add route "DB failure" doesn't exercise a rollback after a category insert

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/integration/subscriptions.routes.test.ts:163-172
- **Detail**: The plan's re-read for this row is "no row, no category". The case uses another user's private category with no new category, so "no category" holds trivially. Through the add route, the parser rejects every value that would make the RPC fail after a category insert. That rollback is proven at the service layer (amount `"0"` and `notFound`, each with a new category).
- **Fix**: Accept as is and note in the test that the post-insert rollback is covered by the service suite.
- **Decision**: FIXED — comment added in the route test pointing to the service suite's rollback cases

### F7 — Config and runtime robustness notes

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: vitest.config.ts:39-42; vitest.config.ts:20-29
- **Detail**: (a) `withoutCloudflare` filters plugins by `name` after `flat()`. A Cloudflare plugin delivered as a `Promise<Plugin>` would have no `name` and slip through. Today the probe proves the filter works. (b) One integration run signs up 9 users against the local limit of 30 per 5 minutes, so about three back-to-back runs, plus `test:rls` and smoke, hit the rate limit. The failure message is clear. (c) The default 10s `hookTimeout` covers `beforeAll` blocks with 2–3 sign-ups, which may be tight on a cold stack.
- **Fix**: Await promise plugins before filtering (or comment the assumption), and set `hookTimeout: 30_000` on the integration project; mention the per-run sign-up count in AGENTS.md.
- **Decision**: FIXED — `flattenPlugins` awaits promise and nested plugin options before the Cloudflare filter; `hookTimeout: 30_000` on the integration project; AGENTS.md notes that one full run signs up 9 users
