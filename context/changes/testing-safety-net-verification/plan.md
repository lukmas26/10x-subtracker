# Safety-net Verification Implementation Plan

## Overview

Rollout Phase 1 of `context/foundation/test-plan.md` covers risks #3, #1 and #5. This plan makes the two existing safety nets (`scripts/rls-check.mjs`, `scripts/smoke.mjs`) fail for the right reason. It covers every protected page and API route with an anonymous step, adds a route inventory test so a new route cannot skip protection unnoticed, proves at the app layer that A's data survives B's attempts, and records a deliberate-break run that shows each check goes red. No new test runner; the existing `node:test` and the two scripts stay the only layers.

## Current State Analysis

From `research.md` (same folder), verified at commit `cf3b646`:

- **Anonymous access (#5).** `PROTECTED_ROUTES = ["/dashboard", "/subscriptions"]` with `startsWith` (`src/middleware.ts:4`, `:19-22`) covers pages only. The 2 API write routes have their own `if (!user)` check (`src/pages/api/subscriptions.ts:14-17`, `src/pages/api/subscriptions/[id].ts:19-22`). Smoke checks 2 anonymous GETs (`scripts/smoke.mjs:188-189`). No anonymous step exists for `/subscriptions/<id>/edit`, `POST /api/subscriptions` or `POST /api/subscriptions/<id>`, and nothing compares the routes under `src/pages/` to any list.
- **Weak assertions (#3).** 8 RLS checks pass on any error (`rls-check.mjs:147`, `:154`, `:167`, `:170`, `:177`, `:193`, `:277`, `:288`), so a renamed RPC parameter or a network error passes them, and the orphan checks then pass vacuously. 3 smoke steps check the status code only (`smoke.mjs:187`, `:200`, `:201`). `/subscriptions` returns 200 on its load-error branch (`src/pages/subscriptions.astro:29`, `:61-63`).
- **Cross-account access (#1).** Isolation lives in the database (RLS policies, `security invoker` RPCs, column-level update grant). Smoke judges B's save on A's row by the response alone (`smoke.mjs:170-174`). "A unchanged" is asserted only through the database API (`rls-check.mjs:239-240`). The case where B creates a category with the same name as A's private one is not checked.
- CI already runs `test:smoke`, `test:rls` and smoke against `npm run preview` (`.github/workflows/ci.yml:22`, `:52-55`, `:57-61`).

## Desired End State

- Every RLS check asserts a specific outcome (error code or row content) confirmed in a local run. No check accepts "any error".
- `scripts/routes.mjs` lists every route file under `src/pages/` as public, protected or dev-only, along with the exact anonymous response each protected route should give. `scripts/routes.test.mjs` fails when a route file is missing from the inventory, and when an inventory entry points to a file that no longer exists.
- Smoke runs an anonymous step for each of the 5 protected routes (GETs in both modes, POSTs in local mode only), plus a case-variant probe.
- The status-only smoke steps prove the page rendered real content. After B's attempts, smoke signs back in as A and confirms A's subscription is unchanged.
- `context/changes/testing-safety-net-verification/break-catalogue.md` records each deliberate break, the check expected to go red, and the FAIL line actually observed. After all reverts the suites are fully green.
- Test plan §6.1 and §6.2 describe the shipped patterns, and `AGENTS.md` describes the new coverage.

### Key Discoveries:

- `describe()` in `rls-check.mjs:45-49` already prints `error <code>`, so one unmodified local run shows the real codes before they are hard-coded.
- Smoke's `request()` sends `Origin` (`smoke.mjs:62`), but `anonymousRequest()` does not (`:72-75`). Astro checks Origin on form POSTs, so an anonymous POST without it would be stopped by the CSRF check, not by the auth check under test.
- `smoke.mjs:157`: A is signed out before B's steps, and the cookie jar is shared, so re-reading A's data requires B to sign out and A to sign in again.
- `npm run test:smoke` already globs `scripts/*.test.mjs` (`package.json:16`), so a new test file joins CI with no workflow change.

## What We're NOT Doing

- Fixing failed-save state checks (`add/edit rejects invalid amount` re-reading persisted rows): that is risk #2, test plan Phase 2.
- Adding new CI steps/YAML (Phase 4 of the test plan).
- Switching test runners. Everything this phase unit-tests is plain JavaScript in `scripts/*.mjs` (route inventory, `rendersList`, matchers) with no TypeScript, `@/` alias or `astro:*` imports. `node:test` runs it with no config or dependency and already runs in CI (`npm run test:smoke`). `smoke.mjs` and `rls-check.mjs` are HTTP/REST scripts and do not depend on any runner. Another runner would add a dependency, config and a migration of 2 test files with no extra signal. The runner for `src/` (TypeScript, `@/` alias, `astro:env/server`, which `node:test` cannot resolve) is chosen in test plan Phase 2 research; Vitest with Astro's `getViteConfig` is the likely candidate. The existing `node:test` files can stay as they are (split: `scripts/` → `node:test`, `src/` → the new runner).
- Scripting the deliberate breaks as a repeatable harness or CI job. The catalogue is a one-off recorded proof (decision in planning).
- Testing server-side session revocation after sign-out (research Open Question 5). It is outside §2 #5 as written; flag it for `--refresh`.
- Changing middleware or route protection itself. If the case-variant probe or any new anonymous step fails on unbroken code, stop and raise it as a separate bug change.
- Editing test plan §1–§3 (the orchestrator owns §3 status; §2 corrections go through the `/10x-test-plan` backport check).

## Implementation Approach

Tighten before you break. Phases 1–3 change assertions and coverage, each verified green on the unbroken app. Phase 4 then breaks the app and database on purpose to prove the tightened checks go red, including breaks the old checks would have missed. Phase 5 writes down the patterns. Expected values come from the test's own inputs (emails, names, amounts) or from the risk definition, never from production code under test.

## Critical Implementation Details

- **Servers and ports.** Before any `npm run preview`/`smoke` run, check ports 4321/8787 (`netstat -ano | grep -E ':(4321|8787) .*LISTENING'`). If something is listening, stop and ask the user (`AGENTS.md` Commands). Never kill it.
- **Local Supabase only.** `test:rls` refuses non-local URLs (`rls-check.mjs:14-25`); keep it that way. Phase 4 SQL breaks go in through a temporary migration plus `npx supabase db reset`, which **wipes local data**. Ask the user once before the first reset.
- **Anonymous POSTs need `Origin`.** The anonymous helper for POSTs must send `Origin: BASE_URL` (and the Access headers in Access mode) but no cookies, so the step tests the auth check rather than the CSRF check.

## Phase 1: Tighten RLS check assertions

### Overview

Replace every "any error counts as denied" assertion with the specific outcome, remove the duplicate weak PATCH check, and add the same-name category case. Covers risks #3 and #1.

### Changes Required:

#### 1. Confirm actual error codes

**File**: none (local run)

**Intent**: Before editing, run `npm run test:rls` against local Supabase and note the `error <code>` printed for each of the 8 weak checks. Expected values are 42501 for anon table reads, anon RPC calls and the no-grant delete, and 23514 for `amount = 0`. If a printed code differs, use the printed code and record why in a comment.

**Contract**: The codes in use are recorded in the Phase 1 commit message.

#### 2. Exact assertions in `rls-check.mjs`

**File**: `scripts/rls-check.mjs`

**Intent**: Each check asserts the protected behaviour, not merely "something failed", so a signature drift or network error turns red instead of passing.

**Contract**:

- Remove the weak update check (`:143-149`); the strict direct-PATCH check (`:232-237`) covers it. Update the S-01 comment.
- Delete check (`:151-156`): expect the no-grant code. The comment states that when a delete feature adds a grant, this check must become "0 rows and A unchanged".
- Anon reads (`:166-170`), anon RPCs (`:192-193`, `:287-288`): expect the confirmed permission code.
- Failed save and failed update with `amount = 0` (`:176-177`, `:271-277`): expect the check-violation code. The orphan and unchanged checks that follow then always exercise a function that actually ran.
- B's private category creation (`:245-251`): abort the run with exit 1 if it fails, like the setup at `:88-91`, so later checks never run with an `undefined` id.

#### 3. Same-name category case

**File**: `scripts/rls-check.mjs`

**Intent**: B saves via `create_subscription` with `p_new_category` equal to A's private category name. The function must not reuse a category B cannot see.

**Contract**: New check, placed after A's unchanged checks. Read B's new subscription's `category_id` back through B's client, then assert it differs from A's category id and that the category's `user_id` is B's id. Expected values come from the setup's own ids.

### Success Criteria:

#### Automated Verification:

- `npm run test:rls` passes against local Supabase, with no `Boolean(...error)`-only assertion left (grep `scripts/rls-check.mjs` for `Boolean(` and confirm each remaining use is not a pass condition on its own)
- `npm run lint` passes

#### Manual Verification:

- The run output shows the new same-name category check as PASS, with B's own category

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Route inventory and anonymous coverage

### Overview

One list of routes drives two checks. A unit test fails when a route file is unaccounted for, and smoke turns each protected entry into an anonymous step. Covers risk #5.

### Changes Required:

#### 1. Route inventory

**File**: `scripts/routes.mjs` (new)

**Intent**: The single source of which routes exist and how an anonymous request to each must be answered.

**Contract**: Exports `ROUTES`, one entry per route file:

- `file`: path under `src/pages/`.
- `access`: `public`, `protected` or `dev-only`.
- For protected entries: `method`, a sample `path` (dynamic segments use a fixed valid UUID such as `00000000-0000-4000-8000-000000000000`), and `anonymous: { status: 302, path: "/auth/signin" }` in the shape `matches()` already accepts.
- POST entries carry a valid subscription form, so that if the auth check were removed the request would reach the RPC and the break would be observable.

Today's 13 files: 5 protected (`dashboard.astro`, `subscriptions.astro`, `subscriptions/[id]/edit.astro`, `api/subscriptions.ts` POST, `api/subscriptions/[id].ts` POST), 1 dev-only (`dev/kitchen-sink.astro`), the rest public.

#### 2. Inventory test

**File**: `scripts/routes.test.mjs` (new)

**Intent**: Turn "a new route cannot skip protection without a red test" into a CI failure that needs no server.

**Contract**: `node:test` cases:

- Every `.astro`/`.ts` file under `src/pages/` (recursive `readdirSync`) has exactly one entry.
- Every entry's file exists.
- Every `protected` entry has `method`, `path` and `anonymous`.
- No `path` duplicates another.

Failure messages name the file and tell the author to classify it in `scripts/routes.mjs`.

#### 3. Anonymous smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Replace the 2 hard-coded anonymous GET steps (`:188-189`) with steps generated from `ROUTES`, and add a case-variant probe.

**Contract**:

- New helper `anonymousAppRequest(path, { method, form })`: sends `Origin` and the Access headers, uses no cookie jar, and does not store cookies.
- Step name: `anonymous <METHOD> <path> redirects to signin`. GET steps run in both modes; POST steps run in local mode only, keeping remote mode read-only.
- Case-variant probe `/Subscriptions` (anonymous GET). Pass condition: 404, or 302 exactly to `/auth/signin`. A 200 fails the step.
- `dashboard redirects after signout` stays as is.

### Success Criteria:

#### Automated Verification:

- `npm run test:smoke` passes, including the new `routes.test.mjs`
- `npm run lint` passes
- `npm run smoke` passes against a local preview, with 5 `anonymous …` steps and the case probe listed as PASS

#### Manual Verification:

- Adding a throwaway `src/pages/tmp-route.astro` makes `npm run test:smoke` fail with a message naming that file; the file is then removed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Harden smoke assertions

### Overview

Status-only steps must prove the page rendered real content, and A's data must be re-read after B's attempts. Covers risks #3 and #1.

### Changes Required:

#### 1. List-rendered matcher

**File**: `scripts/smoke-match.mjs`, `scripts/smoke-match.test.mjs`

**Intent**: A positive proof that `/subscriptions` rendered its list branch (empty state or at least one edit link), so the load-error branch fails even in remote mode, where the account's contents are unknown.

**Contract**: New export `rendersList(body)` returns true when the body contains the list heading and either the empty-state text or an edit link (reuse `extractEditPath`). Unit cases:

- Empty-state body → true.
- Body with an edit link → true.
- Load-error body (heading plus error alert, no empty state, no link) → false.
- Empty body → false.

#### 2. Body checks on status-only steps

**File**: `scripts/smoke.mjs`

**Intent**: The signed-in steps prove they are signed in as this user and that data loaded.

**Contract**:

- `dashboard renders for signed-in user` (`:200`): adds `bodyIncludes: email`, the test's own input.
- `subscriptions renders for signed-in user` (`:201`): adds a `check` that requires status 200 and `rendersList`.
- `home renders` (`:187`) stays a liveness check, and a comment says so.

#### 3. Re-sign-in as A

**File**: `scripts/smoke.mjs`

**Intent**: Prove through the app that B's save attempt did not change A's subscription.

**Contract**: 3 steps appended to the local-only second-account steps:

- `second account signs out`: 302 to `/`.
- `first account signs in again`: 302 to `/`.
- `first account's subscription survived second account's attempts`: `/subscriptions` returns 200, includes `editedName` and `59.99 USD`, and excludes `Smoke-Hijack`.

### Success Criteria:

#### Automated Verification:

- `npm run test:smoke` passes, including the new `rendersList` cases
- `npm run lint` passes
- `npm run smoke` passes against a local preview, with the 3 new steps listed as PASS

#### Manual Verification:

- Smoke output reads clearly: each new step name states the behaviour it protects

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Deliberate-break catalogue

### Overview

Prove that each tightened or new check goes red when its protected behaviour is broken, and record the evidence. Covers risk #3 directly, and #1 and #5 through their checks.

### Changes Required:

#### 1. Break catalogue

**File**: `context/changes/testing-safety-net-verification/break-catalogue.md` (new)

**Intent**: One row per break, listing:

- the break and how it was applied (code edit + rebuild, or a temporary migration + `npx supabase db reset`);
- the check expected to go red;
- the observed FAIL line, copied from output;
- whether the break was reverted.

**Contract**: At minimum these breaks. Each is applied alone and reverted before the next.

| #   | Break                                                                     | Expected red                                                                  |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Remove `"/subscriptions"` from `PROTECTED_ROUTES`                         | smoke `anonymous GET /subscriptions…`, `…/edit`                               |
| 2   | `startsWith` → exact `===` in middleware                                  | smoke `anonymous GET /subscriptions/<uuid>/edit…` (missed before this change) |
| 3   | Delete the `if (!user)` block in `api/subscriptions.ts`                   | smoke `anonymous POST /api/subscriptions…` (missed before)                    |
| 4   | Same in `api/subscriptions/[id].ts`                                       | smoke `anonymous POST /api/subscriptions/<uuid>…` (missed before)             |
| 5   | Add an unlisted page `src/pages/reports.astro`                            | `routes.test.mjs`                                                             |
| 6   | `subscriptions_select_own` → `using (true)`                               | rls `B sees 0 subscriptions`; smoke `second account does not see…`            |
| 7   | `update_subscription` → `security definer`                                | rls B's RPC update and `A unchanged`; smoke B save step and `…survived…`      |
| 8   | `create_subscription` → `security definer`                                | rls same-name category check                                                  |
| 9   | Grant `select` on `categories` to anon with an anon `using (true)` policy | rls `anon sees 0 categories`                                                  |
| 10  | Rename `create_subscription` parameter `p_amount`                         | rls failed-save check (passed vacuously before)                               |
| 11  | Make the subscription list query fail (select a missing column)           | smoke `subscriptions renders for signed-in user` (passed before)              |

If a break does not turn its check red, fix the check (this phase may edit the scripts) and re-run that row. Never weaken the break.

### Success Criteria:

#### Automated Verification:

- After all reverts: `git status` shows no changes outside `scripts/`, `context/` and docs; no temporary migration remains in `supabase/migrations/`
- After all reverts: `npm run test:smoke`, `npm run test:rls` and `npm run smoke` (fresh preview after `npx supabase db reset`) all pass

#### Manual Verification:

- Every catalogue row has an observed FAIL line and is marked reverted
- The user confirms the catalogue is convincing evidence for risks #3, #1 and #5

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 5: Cookbook and docs

### Overview

Write the shipped patterns into test plan §6 so `/10x-tdd` and later slices reuse them, and update `AGENTS.md`.

### Changes Required:

#### 1. Test plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the §6.1 and §6.2 placeholders, and append a Phase 1 note under §6.6.

**Contract**:

- §6.1 Adding an access-control check: two-account check in `scripts/rls-check.mjs` with an exact error code or row read-back; classify each new route in `scripts/routes.mjs`; prove it with a deliberate break. Run commands: `npm run test:rls`, `npm run test:smoke`.
- §6.2 Adding a smoke step that can actually fail: exact redirect or body/`check` assertion, oracle taken from the test's own inputs, the vacuous-pass guard pattern, and a deliberate-break proof. Reference steps and the `npm run smoke` command.
- §6.6: one-line note pointing to `break-catalogue.md`.
- §1–§3 are untouched.

#### 2. Agent guidance

**File**: `AGENTS.md`

**Intent**: Agents adding a page or API route know they must classify it, and know what smoke and `test:smoke` cover now.

**Contract**:

- `npm run test:smoke` line: adds the route inventory test.
- `npm run smoke` line: anonymous steps for every protected route from `scripts/routes.mjs`, plus the A re-sign-in check.
- Auth flow paragraph (the one that names `scripts/smoke.mjs`): adds `scripts/routes.mjs` to the files to update when routes change.

### Success Criteria:

#### Automated Verification:

- `npm run format` leaves `AGENTS.md` and `test-plan.md` unchanged (already formatted)
- `grep -n "TBD — see §3 Phase 1" context/foundation/test-plan.md` returns nothing

#### Manual Verification:

- A reader can add an access check for a new route by following §6.1 alone

**Implementation Note**: After completing this phase and all automated verification passes, the change is ready for `/10x-impl-review` and archive.

---

## Testing Strategy

### Unit Tests:

- `routes.test.mjs`: inventory completeness and consistency against `src/pages/`.
- `smoke-match.test.mjs`: `rendersList` with empty-state, edit-link, load-error and empty bodies.

### Integration Tests:

- `rls-check.mjs` (REST, two accounts plus anon) with exact codes and the same-name category case.
- `smoke.mjs` (HTTP against preview) with generated anonymous steps, body-checked render steps and the A re-sign-in.

### Manual Testing Steps:

1. Phase 2: add and remove a throwaway page to see `routes.test.mjs` go red.
2. Phase 4: run all 11 catalogue breaks and record each FAIL line.

## Performance Considerations

Smoke grows by about 9 HTTP steps (5 anonymous, 1 probe, 3 re-sign-in), which costs seconds. Phase 4 costs one rebuild or DB reset per break, local only, once.

## Migration Notes

No schema change ships. Phase 4 temporary migrations are deleted, and the database is reset to the committed migrations before the final green run. `src/db/database.types.ts` must stay unchanged (the CI types diff would catch drift).

## References

- Research: `context/changes/testing-safety-net-verification/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#1, #3, #5), §6.1, §6.2
- False-PASS precedent: `context/archive/2026-09-30-safe-release-verification/plan.md:11`
- Vacuous-pass guard pattern: `scripts/smoke.mjs:120-122`
- Exact matcher: `scripts/smoke-match.mjs:22-36`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tighten RLS check assertions

#### Automated

- [x] 1.1 `npm run test:rls` passes against local Supabase with no any-error-only assertion left — 2dcfcf6
- [x] 1.2 `npm run lint` passes — 2dcfcf6

#### Manual

- [x] 1.3 Run output shows the same-name category check as PASS with B's own category — 2dcfcf6

### Phase 2: Route inventory and anonymous coverage

#### Automated

- [x] 2.1 `npm run test:smoke` passes, including `routes.test.mjs` — 508e756
- [x] 2.2 `npm run lint` passes — 508e756
- [x] 2.3 `npm run smoke` passes with 5 anonymous steps and the case probe — 508e756

#### Manual

- [x] 2.4 A throwaway unlisted page makes `npm run test:smoke` fail naming the file; then removed — 508e756

### Phase 3: Harden smoke assertions

#### Automated

- [x] 3.1 `npm run test:smoke` passes, including the `rendersList` cases — e00e078
- [x] 3.2 `npm run lint` passes — e00e078
- [x] 3.3 `npm run smoke` passes with the 3 re-sign-in steps — e00e078

#### Manual

- [x] 3.4 New step names state the behaviour they protect — e00e078

### Phase 4: Deliberate-break catalogue

#### Automated

- [x] 4.1 After reverts, no stray changes or temporary migrations remain — 64523ff
- [x] 4.2 After reverts, `test:smoke`, `test:rls` and `smoke` all pass on a reset database — 64523ff

#### Manual

- [x] 4.3 Every catalogue row has an observed FAIL line and is marked reverted — 64523ff
- [x] 4.4 User confirms the catalogue as evidence for risks #3, #1, #5 — 64523ff

### Phase 5: Cookbook and docs

#### Automated

- [x] 5.1 `npm run format` leaves `AGENTS.md` and `test-plan.md` unchanged
- [x] 5.2 No "TBD — see §3 Phase 1" placeholder remains in `test-plan.md`

#### Manual

- [x] 5.3 A reader can add an access check for a new route by following §6.1 alone
