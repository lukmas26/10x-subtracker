<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Safety-net Verification Implementation Plan

- **Plan**: context/changes/testing-safety-net-verification/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-19
- **Verdict**: APPROVED (triage complete 2026-10-20: 7 fixed, 2 accepted)
- **Findings**: 0 critical, 2 warnings, 7 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Success criteria re-run on 2026-10-19 at `a336798`. All of these passed:

- `npm run test:smoke` (47/47)
- `npm run lint`
- `npm run test:rls` (all checks)
- `npm run smoke` against a fresh build and preview (all steps). This includes the 5 anonymous steps, the case probe (404) and the 3 re-sign-in steps.
- `prettier --check` on `AGENTS.md` and `test-plan.md`
- the `TBD — see §3 Phase 1` grep (0 hits)
- the `Boolean(` grep on `rls-check.mjs` (0 hits)

The two planned adaptations are documented in `break-catalogue.md:6` and `:8` and were approved during implementation. One replaced the per-break temporary migration with reversible SQL plus one final reset. The other renamed the function in row 10 instead of the parameter.

## Findings

### F1 — Smoke local mode has no local-host guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:28
- **Detail**: Local mode is chosen only because `SMOKE_EMAIL` is absent. Nothing checks that `BASE_URL` is local. `BASE_URL=https://<hosted> npm run smoke` would therefore sign up two `@example.com` accounts on a hosted environment, write subscriptions there, and send the new anonymous POSTs to it. `rls-check.mjs:14-25` has exactly this guard. The gap predates this change, but this change adds more local-only steps behind the same switch.
- **Fix A ⭐ Recommended**: In local mode, refuse a `BASE_URL` whose host is not `localhost`, `127.0.0.1` or `[::1]`, with an `abort()` message naming `smoke:remote`.
  - Strength: The same guard and host list as `rls-check.mjs`. It is about 5 lines, and CI is unaffected because CI smoke targets `localhost:4321`.
  - Tradeoff: Running a local-mode smoke against a LAN or tunnel host would need an explicit opt-in variable.
  - Confidence: HIGH — the pattern already exists in the sibling script.
  - Blind spot: Not checked whether anyone runs local-mode smoke against a non-localhost preview on purpose.
- **Fix B**: Record it as a follow-up for test-plan Phase 4 (CI and gates) and leave the code as is.
  - Strength: Keeps this change's scope exactly as planned.
  - Tradeoff: The footgun stays until that phase runs.
  - Confidence: MED — depends on when Phase 4 lands.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A): local-host guard added after `const remote` in scripts/smoke.mjs; verified hosted and unparseable BASE_URL abort with exit 1.

### F2 — Inventory checks completeness, not classification

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: scripts/routes.test.mjs:18
- **Detail**: Suppose an author adds a page that should be protected, forgets the middleware prefix, and lists it as `public`. Every test passes, and smoke generates no anonymous step for it. The plan's intent, "a new route cannot skip protection without a red test", therefore holds only up to the author's classification. That classification is a reviewed decision, not a test. Nothing ties `ROUTES` to `PROTECTED_ROUTES` in `src/middleware.ts:4`, and a `node:test` file cannot import that TS module.
- **Fix A ⭐ Recommended**: Document the limit. §6.1 should say that the classification is a human decision checked in review. Raise it at the `/10x-test-plan` backport as negative space for risk #5.
  - Strength: Honest about what the guard proves. No duplicated prefix list to drift.
  - Tradeoff: A wrong `public` label is still caught only in review.
  - Confidence: HIGH — docs-only change.
  - Blind spot: None significant.
- **Fix B**: Add a test that every `public` page's file-derived URL does not start with a protected prefix. The prefix list is copied into `routes.mjs`.
  - Strength: Catches a mislabelled page under an existing protected prefix.
  - Tradeoff: It duplicates the middleware list, which can drift. It still does not catch a new top-level path like `/settings`, the likelier case.
  - Confidence: MED — only partial coverage of the real failure.
  - Blind spot: How Phase 2's `src/` runner could test the middleware directly instead.
- **Decision**: FIXED (Fix A): caveat added under §6.1 "New page or API route"; backport item queued in follow-ups/review-fixes.md.

### F3 — Route file filter misses other routable extensions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/routes.test.mjs:14
- **Detail**: `/\.(astro|ts)$/` skips `.js`, `.md`, `.mdx` and `.html` routes, so a route in one of those formats would bypass the inventory. It also requires entries for `_`-prefixed files, which Astro does not route. Neither kind of file exists today.
- **Fix**: Widen the filter to `/\.(astro|ts|js|md|mdx|html)$/`, and skip paths with a segment starting with `_`.
- **Decision**: FIXED: filter widened to astro|ts|js|md|mdx|html and `_` segments skipped; verified an unlisted .md page goes red and a `_` file is ignored.

### F4 — rendersList has no case that must fail on the missing heading

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke-match.test.mjs:159
- **Detail**: No case covers an empty-state or edit-link body without "Your subscriptions". §6.2 asks for "a case that must not match", and this heading guard is what tells the list apart from other pages.
- **Fix**: Add `rendersList("<p>No subscriptions yet</p>") === false`.
- **Decision**: FIXED: added "list content without the list heading does not count as rendered" (empty state and edit link without the heading).

### F5 — Failed remote dashboard step prints SMOKE_EMAIL

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:280
- **Detail**: When a step fails, smoke prints `JSON.stringify(expected)`. The new `bodyIncludes: email` means a failed remote run logs the real account email. That is personal data, not a secret. CI runs local mode only.
- **Fix**: In remote mode, give the dashboard step a `describe` such as "body includes the signed-in email", so the value is not printed.
- **Decision**: FIXED: dashboard step uses a check with its own describe, so a failure no longer prints the email.

### F6 — Network errors abort smoke with a raw stack trace

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:274
- **Detail**: When `fetch` throws (for example, the server is not running), the top-level await rejects. The exit code is correct, but there is no `smoke:` message and no summary. The behaviour predates this change.
- **Fix**: Wrap each `run()` in try/catch and count the step as FAIL with the error message. Alternatively, abort with `smoke: cannot reach <BASE_URL>`.
- **Decision**: FIXED: each step run in try/catch; a request error is a FAIL line with the message, and the run still exits 1.

### F7 — Unplanned fifth inventory test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: scripts/routes.test.mjs:34
- **Detail**: "every entry has a known access level" was not in the plan's list of 4 cases. It is consistent with the plan's intent and catches a typo like `"protect"`, which would otherwise skip smoke generation silently.
- **Fix**: No code change. Keep it, and treat this report as the record.
- **Decision**: ACCEPTED: kept as a scope addition; this report is the record.

### F8 — RLS_DENIED comment describes writes only

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/rls-check.mjs:36
- **Detail**: The comment says 42501 is returned "when an RLS policy rejects a write". It is now also the expected code for no-grant reads, the no-grant delete and anon RPC calls.
- **Fix**: Reword to "…when an RLS policy rejects a write, or the role lacks the table/function grant."
- **Decision**: FIXED: comment now also names missing table/function grants.

### F9 — 5.1 verified with prettier --check, not npm run format

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-safety-net-verification/plan.md:422
- **Detail**: The criterion names `npm run format`. Implementation and this review used `prettier --check` on the two files instead. It is the same check, but read-only, so it avoids reformatting the user's uncommitted `CLAUDE.md`.
- **Fix**: None needed.
- **Decision**: ACCEPTED: prettier --check is the equivalent read-only check.
