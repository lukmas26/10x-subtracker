---
date: 2026-10-15T06:33:18+02:00
researcher: Claude (claude-opus-5-5)
git_commit: cf3b646
branch: create-test-plan
repository: test-repo
topic: "Ground rollout Phase 1 of test-plan.md (Safety-net verification): risks #3, #1, #5"
tags: [research, testing, smoke, rls, middleware, auth, isolation]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (claude-opus-5-5)
---

# Research: Safety-net verification (test plan Phase 1, risks #3, #1, #5)

**Date**: 2026-10-15T06:33:18+02:00
**Researcher**: Claude (claude-opus-5-5)
**Git Commit**: cf3b646 (working tree: `CLAUDE.md` modified, unrelated)
**Branch**: create-test-plan
**Repository**: test-repo

## Research Question

For risks #3 (safety net reports PASS while the protected behaviour is broken), #1 (cross-account read/edit/save) and #5 (anonymous access to protected pages/API routes) from `context/foundation/test-plan.md` §2: ground the real failure path in code, map every smoke step and RLS check to its assertion and to what would actually break it, list every protected page/API route against the protected-prefix list, locate existing tests, pick the cheapest useful layer, and verify or correct the Risk Response Guidance.

Inspected scope: `src/middleware.ts`, every file under `src/pages/` (13 files), `src/lib/services/subscriptions.ts`, `scripts/smoke.mjs`, `scripts/smoke-match.mjs`, `scripts/smoke-match.test.mjs` (test names), `scripts/rls-check.mjs`, all 3 files in `supabase/migrations/`, `.github/workflows/ci.yml`, `context/foundation/lessons.md`, `context/archive/2026-09-30-safe-release-verification/{plan.md,plan-brief.md}` (grep), git log of `scripts/`, `src/middleware.ts`, `src/pages/api/`. Nothing was executed (no smoke/RLS run); every "would break" statement below is derived by reading the code, not observed. Confirming those derivations is the job of the deliberate-break runs this phase plans.

## Summary

1. **Both safety nets run in CI** (`.github/workflows/ci.yml:52-55` for `test:rls`, `:57-61` for `smoke` against `npm run preview`), and the matcher (`scripts/smoke-match.mjs`) is unit-tested (26 `node:test` cases, `scripts/smoke-match.test.mjs`) as a result of the archived false-PASS incident. The CI wiring itself is sound; the weaknesses are in individual assertions and in route coverage.

2. **Risk #5 — the protected-prefix list does not cover the API routes.** `PROTECTED_ROUTES = ["/dashboard", "/subscriptions"]` (`src/middleware.ts:4`) is matched with `startsWith` (`:19`), so `/api/subscriptions` and `/api/subscriptions/<id>` are not middleware-protected. Each of the 2 write handlers carries its own `if (!user) return context.redirect("/auth/signin")` (`src/pages/api/subscriptions.ts:14-17`, `src/pages/api/subscriptions/[id].ts:19-22`); the database is the backstop (both RPCs `revoke ... from public, anon`, migrations `20261003140000…:151`, `20261010120000…:256`). Smoke tests anonymous access on exactly 2 GET paths (`/dashboard`, `/subscriptions`, `scripts/smoke.mjs:188-189`) plus `/dashboard` after sign-out (`:205`). Not tested anonymously: `/subscriptions/<id>/edit`, `POST /api/subscriptions`, `POST /api/subscriptions/<id>`. The guidance "a new route cannot skip protection without a red test" has no mechanism today: nothing compares the route set to the protected list.

3. **Risk #1 — isolation is covered on all five named paths, but at different layers.** List, edit page and app save are covered by smoke (`scripts/smoke.mjs:169-180`); RPC create, RPC update, direct REST insert/PATCH and category visibility by `rls-check.mjs` (`:95-170`, `:185-190`, `:223-269`). "A's data is unchanged afterwards" is asserted only at the REST layer (`rls-check.mjs:239-240`, `:284-285`); smoke checks B's save attempt by its response only (`smoke.mjs:170-174`) and never re-reads A's row. The "RLS exists, so sealed" assumption is partly right here: the app paths use the request's RLS-scoped client and `security invoker` RPCs, so the app inherits DB isolation — which is why the deliberate-break target for #1 should be the database policies and function security mode, not only app code.

4. **Risk #3 — 11 checks can pass for a reason other than the protected behaviour.** 8 RLS checks accept _any_ error (`Boolean(x.error)`), so a wrong RPC signature or a network error passes them (`rls-check.mjs:147`, `:154`, `:167`, `:170`, `:177`, `:193`, `:277`, `:288` — detailed table below); 3 smoke steps assert status 200 only (`smoke.mjs:187`, `:200`, `:201`), and `/subscriptions` renders 200 on its load-error branch (`src/pages/subscriptions.astro:29`, `:61-63`; no status change), so `subscriptions renders for signed-in user` (`smoke.mjs:201`) passes when the list fails to load — and in remote mode (`smoke.mjs:203`) that is the only subscription check. No check has ever been deliberately broken to prove it fails; the only proven-red case is the archived prefix-match incident, now pinned by matcher unit tests.

5. **Cheapest layers confirmed:** route-protection gaps → new smoke steps (HTTP, already in CI); weak RLS assertions → tighten error codes in `rls-check.mjs` (same layer, no new infra); proving each check can fail → a scripted/documented deliberate-break run (manual, local, not a CI step). No new test runner is needed for this phase.

## Detailed Findings

### Risk #5 — route inventory vs `PROTECTED_ROUTES`

`src/middleware.ts:4` — `const PROTECTED_ROUTES = ["/dashboard", "/subscriptions"];`
`src/middleware.ts:19-22` — `if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) { if (!context.locals.user) return context.redirect("/auth/signin"); }`

| Route (file)                                                 | Method | Should be protected | Middleware prefix match   | Own check                                                             | DB backstop for anon                                                                                      | Anonymous smoke step    |
| ------------------------------------------------------------ | ------ | ------------------- | ------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------- |
| `/` (`index.astro`)                                          | GET    | no                  | —                         | —                                                                     | —                                                                                                         | `home renders` (200)    |
| `/auth/signin`, `/auth/signup`, `/auth/confirm-email`        | GET    | no                  | —                         | —                                                                     | —                                                                                                         | none (public)           |
| `/api/auth/signin`, `/signup`, `/signout`                    | POST   | no                  | —                         | —                                                                     | —                                                                                                         | used by flow            |
| `/dashboard` (`dashboard.astro`)                             | GET    | yes                 | `/dashboard`              | none                                                                  | n/a (no data read)                                                                                        | `smoke.mjs:188`, `:205` |
| `/subscriptions` (`subscriptions.astro`)                     | GET    | yes                 | `/subscriptions`          | none                                                                  | anon has no grants (`20261003120000…:43-44`)                                                              | `smoke.mjs:189`         |
| `/subscriptions/<id>/edit` (`subscriptions/[id]/edit.astro`) | GET    | yes                 | `/subscriptions` (prefix) | none                                                                  | anon has no grants                                                                                        | **none**                |
| `/api/subscriptions` (`api/subscriptions.ts`)                | POST   | yes                 | **no** (`/api/…`)         | `:14-17` → 302 `/auth/signin`                                         | `create_subscription` revoked from anon (`20261003140000…:151`) and raises 42501 on null uid (`:111-113`) | **none**                |
| `/api/subscriptions/<id>` (`api/subscriptions/[id].ts`)      | POST   | yes                 | **no**                    | `:19-22` → 302 `/auth/signin`                                         | `update_subscription` revoked from anon (`20261010120000…:256`), 42501 on null uid (`:205-207`)           | **none**                |
| `/dev/kitchen-sink`                                          | GET    | no (dev only)       | —                         | `import.meta.env.DEV`; prod sets 404 and renders `{enabled && (...)}` | fixture data only, no DB                                                                                  | none needed             |

What breaks protection, and whether the current suite would go red (derived, not run):

| Deliberate break                                                                    | Observable effect                                                                                               | Caught today?                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Remove `"/subscriptions"` from `PROTECTED_ROUTES`                                   | anon `GET /subscriptions` renders 200 (load fails → error branch)                                               | yes — `smoke.mjs:189` expects 302                          |
| Remove `"/dashboard"`                                                               | anon `GET /dashboard` 200                                                                                       | yes — `smoke.mjs:188`, `:205`                              |
| Change `startsWith` to exact `===`                                                  | `/subscriptions/<id>/edit` no longer protected; `/subscriptions`, `/dashboard` still redirect                   | **no** — no nested-path anonymous step                     |
| Delete the `if (!user)` block in `api/subscriptions.ts`                             | anon POST → RPC fails (anon not granted) → 302 `/subscriptions?error=Could not save…` instead of `/auth/signin` | **no** — no anonymous POST step; DB still blocks the write |
| Same in `api/subscriptions/[id].ts`                                                 | anon POST with a valid uuid → `update_subscription` denied → 302 to edit page with `?error=`                    | **no**                                                     |
| Add a new protected page/API route (next slice) without a prefix entry or own check | route open to anon                                                                                              | **no** — nothing enumerates routes                         |

Correction to §2 guidance for #5: "dashboard redirects, so everything is protected" is a real assumption in the current suite — 2 of 3 protected pages and 0 of 2 protected API routes have an anonymous step. The response should also name the _two_ protection mechanisms (middleware prefix for pages, in-handler check for API routes) because a single test strategy over one mechanism misses the other. Smoke can enumerate a fixed list; a red test for a _new_ route requires a list that is compared to `src/pages/` (e.g. a matcher-level `node:test` that globs `src/pages/**` and fails when a route is neither in a public allowlist nor in the protected/anonymous-check list). That is a cheap unit-level guard; whether it is worth it vs a checklist is a plan decision.

Unverified edge (open question, not a confirmed gap): `startsWith` is case-sensitive; whether Astro on the Cloudflare adapter serves `/Subscriptions` from `subscriptions.astro` was not checked. If it does, the page would render with an anon client and hit RLS (no data, load-error branch). A single smoke probe would settle it.

### Risk #1 — cross-account paths

Data access: the middleware puts the request's cookie-session client in `locals.supabase` (`src/middleware.ts:7-8`); services query through it with no explicit `user_id` filter and rely on RLS (`src/lib/services/subscriptions.ts:184-191` `getSubscription`, `:207-213` `listSubscriptions`, `:229-231` `listCategories`). Writes go through `security invoker` RPCs (`20261003140000…:102`, `20261010120000…:196`), so RLS and grants apply to the caller. Another account's id is reported as P0002 by `update_subscription` (`:247-249`) and mapped to "not found" (`subscriptions.ts:152-153`, `:177`; route `[id].ts:36-39`).

Policies (`20261003120000…:52-84`, `20261010120000…:157-175`): select own subscriptions; select starter-or-own categories; insert own with visible category; update own with `user_id` fixed and visible category; column-level update grant excludes `user_id` (`20261010120000…:157`); no delete grant or policy on either table (`20261003120000…:45-46`).

Path coverage:

| Path B uses against A                                       | Smoke                                                  | rls-check                              | A unchanged asserted?  |
| ----------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | ---------------------- |
| List page                                                   | `smoke.mjs:175-180` (empty state + excludes A's names) | `:96-97` B sees 0 subs                 | n/a                    |
| Edit page by A's id                                         | `smoke.mjs:169` (302 `/subscriptions?error=`)          | (select covered by `:96`)              | n/a                    |
| App save `POST /api/subscriptions/<A id>`                   | `smoke.mjs:170-174` (302 `/subscriptions?error=`)      | —                                      | **no** (response only) |
| RPC `update_subscription` on A's id                         | —                                                      | `:225-230` expects P0002               | yes `:239-240`         |
| Direct REST PATCH                                           | —                                                      | `:144-149` (weak), `:232-237` (strict) | yes `:239-240`         |
| Direct insert with `user_id = A`                            | —                                                      | `:114-125` expects 42501               | —                      |
| Insert / RPC create into A's private category               | —                                                      | `:127-135`, `:185-190` expect 42501    | —                      |
| Read A's private category                                   | —                                                      | `:99-104`                              | n/a                    |
| Move own row into other's category (RPC, PATCH)             | —                                                      | `:253-269` expect 42501                | —                      |
| Change `user_id`                                            | —                                                      | `:242-243` expects 42501               | —                      |
| Delete A's row                                              | — (no feature)                                         | `:151-156` (any error passes)          | yes via `:158-163`     |
| B's new category named like A's private category reuses A's | —                                                      | **not checked**                        | —                      |

Smoke guard against a vacuous pass is in place: when no edit path was captured, isolation steps fail rather than pass (`smoke.mjs:120-122`).

What a deliberate break of #1 would look like and whether it would be caught (derived):

- `subscriptions_select_own` changed to `using (true)` → `rls-check.mjs:97` FAIL, smoke `:175-180` FAIL.
- `update_subscription` switched to `security definer` → B's RPC update would update A's row (the function runs as owner, RLS bypassed): `rls-check.mjs:226-230` FAIL (no P0002), `:240` FAIL; smoke `:170-174` FAIL (302 `?updated=1`).
- Update policy `using` relaxed to `true` while `with check` keeps `user_id = auth.uid()` → the update matches A's row, then `with check` fails with 42501 → `rls-check.mjs:226-230` FAIL (expects P0002, gets 42501); the strict PATCH check `:232-237` FAIL (`!bPatch.error` required). Caught.
- Service adds a client-side filter but RLS dropped: not a realistic break here; the services have no filters to drop.

Correction to §2 guidance for #1: the "A unchanged afterwards" requirement is met at the REST layer but not at the app layer; smoke cannot re-read A's row after B's attempts without A's session (A is already signed out, `smoke.mjs:157`). Options for the plan: re-sign-in as A at the end of smoke and assert the list still shows `editedName`/`59.99 USD`, or accept the REST-layer assertion as sufficient because the app path delegates to the same RPC. Also add the "same-name category" case to rls-check (B creates a category with A's private name via `create_subscription` with `p_new_category`; assert the resulting row's category is B's own).

### Risk #3 — every check mapped to its assertion and its weak spot

Smoke (`scripts/smoke.mjs`, matcher `scripts/smoke-match.mjs:10-51`; redirect path matched exactly, `?error=` presence asserted both ways, `:22-36`):

| Step (line)                                                 | Asserts                                                              | Would go red when                             | Can pass for the wrong reason?                                                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preview blocks anonymous request (`:185`, Access mode only) | 401/403 or 302 to `*.cloudflareaccess.com` (`smoke-match.mjs:71-79`) | Access removed                                | no (unit-tested `smoke-match.test.mjs:106-120`)                                                                                                                                                 |
| home renders (`:187`)                                       | 200                                                                  | home 5xx                                      | yes — status only (low stakes)                                                                                                                                                                  |
| dashboard / subscriptions redirect anonymous (`:188-189`)   | 302 exact `/auth/signin`                                             | prefix entry removed                          | no                                                                                                                                                                                              |
| signup creates account (`:193-196`)                         | 302 `/auth/confirm-email`, no error                                  | signup error                                  | no                                                                                                                                                                                              |
| signin rejects wrong password (`:78-82`)                    | 302 `/auth/signin` with `?error=`                                    | wrong password accepted                       | no                                                                                                                                                                                              |
| signin accepts correct password (`:83-87`)                  | 302 `/`, no error                                                    | sign-in broken (the archived false-PASS case) | no (pinned by `smoke-match.test.mjs:10`)                                                                                                                                                        |
| dashboard renders for signed-in user (`:200`)               | 200                                                                  | session not established                       | weakly — dashboard has no data load                                                                                                                                                             |
| subscriptions renders for signed-in user (`:201`)           | 200                                                                  | page 5xx                                      | **yes** — load error renders 200 (`subscriptions.astro` `catch` → `loadError`); in remote mode this is the only subscription check                                                              |
| add subscription rejects invalid amount (`:93-101`)         | 302 `/subscriptions?error=`                                          | validation dropped                            | partially — any error passes; persisted state not re-read (risk #2 territory)                                                                                                                   |
| add subscription saves (`:102-110`)                         | 302 `/subscriptions`, no error                                       | save fails                                    | no; and `:111` confirms the name in the list                                                                                                                                                    |
| list links to edit page (`:128-138`)                        | 200 + uuid edit link captured                                        | list missing edit link                        | no                                                                                                                                                                                              |
| edit page renders prefilled (`:139`)                        | 200 + body contains original name                                    | edit page broken                              | no                                                                                                                                                                                              |
| edit rejects invalid amount (`:140-144`)                    | 302 to edit page with `?error=`                                      | validation dropped                            | partially — persisted state not re-read (risk #2)                                                                                                                                               |
| edit saves + list shows edited (`:145-154`)                 | 302; list includes new name and `59.99 USD`, excludes old            | edit not persisted                            | no                                                                                                                                                                                              |
| signout clears session (`:204`)                             | 302 `/`                                                              | —                                             | yes alone; but next step `:205` goes red if cookies are not expired (`storeCookies` deletes only on `max-age=0`, `:45-53`). Server-side token revocation is not tested (replaying old cookies). |
| second-account steps (`:158-181`)                           | see risk #1 table                                                    | isolation broken                              | save step: response only                                                                                                                                                                        |

RLS check (`scripts/rls-check.mjs`):

| Check (line)                                                                      | Asserts                             | Weak spot                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A creates category / subscription (`:73`, `:82-86`)                               | owner = A                           | setup; aborts on failure (`:88-91`)                                                                                                                                                                                                        |
| B sees 0 subscriptions (`:97`)                                                    | 0 rows, no error                    | sound — A has a row at this point                                                                                                                                                                                                          |
| B sees only starters (`:100-104`)                                                 | ≥1 row, all `user_id null`, not A's | sound                                                                                                                                                                                                                                      |
| B insert as A / into A's category / starter category (`:125`, `:131-135`, `:141`) | error code `42501`                  | sound (specific code)                                                                                                                                                                                                                      |
| B updating A's subscription affects 0 rows (`:144-149`)                           | **any error** or 0 rows             | passes on any error; superseded by the strict `:232-237`. Comment `:143` ("delete has no grant yet") is S-01 wording; update now has a grant                                                                                               |
| B deleting A's subscription (`:151-156`)                                          | **any error** or 0 rows             | no delete grant exists, so this currently always errors (permission denied) — it cannot fail until a delete grant is added; then it becomes meaningful                                                                                     |
| A still sees its one subscription unchanged (`:158-163`)                          | 1 row, same id + name               | sound                                                                                                                                                                                                                                      |
| anon sees 0 subscriptions / categories (`:166-170`)                               | **any error** or 0 rows             | passes on any error (e.g. network) — anon has no grants, so it always errors today                                                                                                                                                         |
| A's failed save rejected (`:176-177`)                                             | **any error**                       | passes if the RPC call errors for another reason (e.g. renamed parameter → "function not found"), and then the orphan check `:178-183` passes vacuously because the function never ran                                                     |
| no orphan category (`:178-183`)                                                   | 0 rows by name                      | see previous row                                                                                                                                                                                                                           |
| B cannot RPC-save into A's category (`:185-190`)                                  | `42501`                             | sound                                                                                                                                                                                                                                      |
| anon cannot call create_subscription (`:192-193`)                                 | **any error**                       | same signature-drift weakness                                                                                                                                                                                                              |
| A updates own via RPC + reads back (`:207-221`)                                   | returned id + all fields            | sound; expected values are literals from the test, not from the implementation                                                                                                                                                             |
| B's RPC update of A's row (`:225-230`)                                            | `P0002`                             | sound                                                                                                                                                                                                                                      |
| B's direct PATCH (`:232-237`)                                                     | no error, 0 rows                    | sound                                                                                                                                                                                                                                      |
| A unchanged after B (`:239-240`)                                                  | all fields equal `edited`           | sound                                                                                                                                                                                                                                      |
| A cannot change `user_id` (`:242-243`)                                            | `42501`                             | sound (column grant)                                                                                                                                                                                                                       |
| A cannot move into B's category, RPC/PATCH (`:253-269`)                           | `42501`                             | sound; depends on `:250` creating B's category (no abort if it fails — `bCategoryId` would be `undefined`, the RPC would then get `p_category_id: undefined`, which could produce a different error code and FAIL loudly rather than pass) |
| A's failed update rejected + no orphan + unchanged (`:271-285`)                   | any error; 0 rows; fields unchanged | the "any error" part has the signature-drift weakness, but `:284-285` (row unchanged) is independent and sound                                                                                                                             |
| anon cannot call update_subscription (`:287-288`)                                 | **any error**                       | signature-drift weakness                                                                                                                                                                                                                   |

Oracle check: expected values in both scripts come from the scenario (literal names, amounts, `edited` object, empty-state copy) rather than from production code, with two exceptions that are contract-level, not oracles of computed output: the `P0002` code (`rls-check.mjs:197`) and the `"No subscriptions yet"` copy (`smoke.mjs:179` ↔ `src/pages/subscriptions.astro:66`). Neither is a tautology; a copy change would make the smoke step fail loudly, not pass silently.

Correction to §2 guidance for #3: the guidance holds. Add the concrete pattern found: **"any error counts as denied"** is the dominant weak-assertion pattern in this repo (8 RLS checks), and the fix is a specific expected error code (42501 for the anon/permission cases, the check-constraint code 23514 for `amount = 0` — to be confirmed in a run, not assumed).

### Existing tests (located)

- `scripts/smoke-match.test.mjs` — 26 `node:test` cases over `matches`, `blocksAnonymous`, `extractEditPath`; runs as `npm run test:smoke` in CI (`ci.yml:22`).
- `scripts/ui-literals-check.test.mjs` — UI literal matcher; unrelated to these risks.
- `scripts/smoke.mjs`, `scripts/rls-check.mjs` — the two safety nets under review; both in the CI `smoke` job.
- No tests under `src/`; no test-runner config (consistent with test-plan §4).

## Code References

- `src/middleware.ts:4` — `PROTECTED_ROUTES` list (pages only)
- `src/middleware.ts:19-22` — prefix match and redirect
- `src/pages/api/subscriptions.ts:14-17` — in-handler auth check for create
- `src/pages/api/subscriptions/[id].ts:19-22` — in-handler auth check for edit; `:24-28`, `:36-39` not-found mapping
- `src/pages/subscriptions/[id]/edit.astro` (frontmatter) — invalid/unknown/foreign id → redirect `?error=Subscription not found.`
- `src/lib/services/subscriptions.ts:152-153`, `:177` — P0002 → not found
- `supabase/migrations/20261003120000_subscriptions_and_categories.sql:43-84` — grants and policies
- `supabase/migrations/20261003140000_create_subscription_rpc.sql:102`, `:111-113`, `:151-152` — invoker, null-uid guard, anon revoke
- `supabase/migrations/20261010120000_update_subscription.sql:157-175`, `:196`, `:247-249`, `:256-257` — column grant, update policy, invoker, P0002, anon revoke
- `scripts/smoke.mjs:183-207` — step list; `:120-122` vacuous-pass guard; `:157` A signed out before B
- `scripts/smoke-match.mjs:22-36` — exact redirect matcher
- `scripts/rls-check.mjs:144-156`, `:166-170`, `:176-177`, `:192-193`, `:277`, `:287-288` — "any error" assertions
- `.github/workflows/ci.yml:22`, `:52-55`, `:57-61` — matcher tests, RLS check, smoke in CI

## Architecture Insights

- Two independent protection mechanisms for anonymous access: middleware prefix list for pages, in-handler `if (!user)` for API routes, with DB grants/RPC revokes as backstop for both. Any route-coverage test must exercise both.
- Isolation is enforced in the database (RLS + `security invoker` RPCs + column grant); the app layer adds no ownership filtering. App-level isolation tests are therefore end-to-end confirmations of DB policy, and the decisive deliberate breaks are SQL changes (policy `using`, `security definer`), not TypeScript changes.
- Smoke runs one browser-less cookie jar with sequential accounts; A cannot be re-read after B's attempts without a fresh sign-in.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-safe-release-verification/plan.md:11` — supported: the smoke redirect check was a prefix match and passed `signin accepts correct password` on `/auth/signin?error=…`. Current code replaces it with an exact matcher (`smoke-match.mjs:22-36`) and pins that case in `smoke-match.test.mjs:10`. This is the "false PASS already shipped once" evidence in test-plan §2 #3 — the evidence is accurate.
- Git history: `src/middleware.ts` changed in `26a7d27` (S-01 adds `/subscriptions`) and `adb9304`; API routes in `26a7d27`, `adb9304`, `bf2af9e`. Consistent with test-plan's hot-spot evidence that each slice touches routes; the hot-spot citations for #5 are not misleading.
- `context/foundation/lessons.md` (atomic multi-table writes) — now implemented through RPCs; the rls-check orphan checks (`:178-183`, `:278-283`) are the guard. Relevant to #2, not to this phase.

## Related Research

Not applicable — no earlier `research.md` covers the safety nets; the archived safe-release-verification change has `plan.md`/`plan-brief.md` only.

## Open Questions

1. Does Astro on the Cloudflare adapter route `/Subscriptions` (case variant) or `/subscriptions/` to the protected pages? If yes, the case-sensitive `startsWith` is bypassable for pages (data still RLS-protected). One smoke probe settles it.
2. Exact error codes returned by PostgREST for anon calls to revoked RPCs and for `amount = 0` (expected 42501 / 23514) — confirm in a local run before hard-coding them.
3. Plan decision: should "A unchanged after B's app-level save attempt" be asserted in smoke (re-sign-in as A) or is the REST-layer assertion (`rls-check.mjs:239-240`) accepted as sufficient?
4. Plan decision: route-enumeration guard (unit test over `src/pages/**` with a public allowlist) vs a documented checklist for new routes.
5. Server-side session revocation after sign-out (replaying old cookies) is untested; it is outside §2 #5 as written ("anonymous visitor") — flag for `--refresh` if the team considers it in scope.
