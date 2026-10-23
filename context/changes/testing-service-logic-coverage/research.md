---
date: 2026-10-22T15:56:02+02:00
researcher: Claude (Opus 5.5) for lukmas26
git_commit: 5699a27279995935d355a95207dd070abe8a006f
branch: testing-service-logic-coverage
repository: test-repo (10x-astro-starter)
topic: "Test plan Phase 2 — service logic coverage: where atomic writes, save feedback, category reuse and validation rules live, and what a src/ test runner must handle"
tags: [research, testing, subscriptions, supabase, rpc, validation, test-runner]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude (Opus 5.5) for lukmas26
last_updated_note: "Recorded the user's decisions on Open Questions 1-5 (see Decisions)"
---

# Research: Test plan Phase 2 — service logic coverage

**Date**: 2026-10-22T15:56:02+02:00
**Researcher**: Claude (Opus 5.5) for lukmas26
**Git Commit**: 5699a27
**Branch**: testing-service-logic-coverage
**Repository**: test-repo (10x-astro-starter)

## Research Question

For `context/foundation/test-plan.md` §3 Phase 2 (risks #2, #4, #6), and following the Risk Response Guidance row for each risk (`test-plan.md:57,59,61`):

1. **#2 Atomicity.** Where is the transaction boundary of each write? What is the error translation path? Which forced failures can happen after a partial write?
2. **#4 Honest feedback.** What is the error path from the service to the UI? When does a "saved/updated" confirmation appear? What rule compares category names?
3. **#6 One rule set.** Where does each validation rule live in the form, the server and the database? Do they agree?
4. **Runner.** What must a `src/` test runner handle?
5. **Existing coverage.** What do `test:rls` and `smoke` already cover, so Phase 2 does not duplicate it?

## Summary

- **#2: both writes are already a single transaction.** `createSubscription` and `updateSubscription` each make exactly one RPC call (`src/lib/services/subscriptions.ts:133`, `:167`). Each RPC resolves or creates the category and writes the row inside one plpgsql function (`supabase/migrations/20261003140000_create_subscription_rpc.sql:31-60`, `20261010120000_update_subscription.sql:59-97`).
  - `scripts/rls-check.mjs:168-181` and `:273-292` already prove the rollback at the database level for one forced failure per RPC: amount 0 together with a new category name.
  - Nothing tests the service-level translation. Nothing tests the rollback for any other failure that occurs after the category insert, such as `P0002` on update or an FK violation.
  - The `lessons.md:7` anchor ("separate PostgREST calls" at `subscriptions.ts:127`) is stale about the location. The rule itself still holds.
- **#4: the confirmation is gated by the server on a no-error RPC result, but the page trusts the URL.** `/subscriptions` shows "Subscription saved" / "Subscription updated" whenever `?saved=1` / `?updated=1` is present (`src/pages/subscriptions.astro:12-13,41-55`). No row is re-read, so a crafted link shows a confirmation for nothing.
  - On the server, a success redirect happens only when `rpc()` returned no `error` (`src/pages/api/subscriptions.ts:29`, `[id].ts:42`). A network failure resolves to `{ error }` and is not retried for POST (`node_modules/@supabase/postgrest-js/dist/index.mjs:81-84,416`). So the server path does not show "saved" after a thrown or returned error.
  - Category reuse is decided only in SQL: `lower(c.name) = lower(btrim(input))`, starters first (`create_subscription_rpc.sql:24,34-39`). It is backed by the unique index `(user_id, lower(name)) nulls not distinct` (`20261003120000_subscriptions_and_categories.sql:12-13`).
  - Outer spaces and case are normalised. **Inner whitespace is not normalised** ("Cloud  storage" ≠ "Cloud storage"). Nothing in the repo tests reuse of an existing category typed with different case or whitespace.
- **#6: the rules live in three places, with partial sharing.**
  - Form (`SubscriptionForm.tsx:63-95`) and server (`subscriptions.ts:76-113`) share the constants in `src/types.ts:3-48`. Each re-implements the checks with different messages.
  - The DB has its own `check` constraints (`20261003120000…sql:8,31-34`) and RLS policies.
  - The form does not validate currency or cycle (select only).
  - JS `.length` (UTF-16 code units) differs from Postgres `char_length` (code points). For astral characters (e.g. emoji) the app is stricter than the DB.
- **Runner.** The service code imports only `@/types` and type-only `@/db/database.types` (`subscriptions.ts:1-16`). It needs the `@/*` path alias (`tsconfig.json:8-10`) but no `astro:env`.
  - `src/lib/supabase.ts:4` and `src/middleware.ts` do import `astro:env/server`, so testing them needs Astro's Vite config.
  - Node is `22.23.3` (`.nvmrc`). Astro itself is developed against `vitest ^4.1.11` (`node_modules/astro/package.json:197`) and exports `getViteConfig` (`node_modules/astro/dist/config/index.js:4`). No runner is installed (`package.json`).

## Detailed Findings

### 1. Write paths and transaction boundaries (#2)

- **Add**, `POST /api/subscriptions` (`src/pages/api/subscriptions.ts:8-30`):
  1. `locals.supabase` null → `?error=notConfigured`.
  2. No user → `/auth/signin`.
  3. `parseNewSubscription` fails → `?error=<msg>`, with no DB call.
  4. `createSubscription` fails → `?error=<msg>`.
  5. Otherwise `/subscriptions?saved=1`.
- **Edit**, `POST /api/subscriptions/[id]` (`src/pages/api/subscriptions/[id].ts:13-43`):
  - A non-UUID id → `/subscriptions?error=notFound` (`:26-28`).
  - A parse error → `/subscriptions/<id>/edit?error=<msg>`.
  - The service's `notFound` → `/subscriptions?error=notFound`. Any other service error → the edit page (`:38`).
  - Success → `/subscriptions?updated=1` (`:42`).
- **Service.** Each function makes exactly one `supabase.rpc(...)` call. It returns `{ ok: true }` when `error` is falsy and ignores the returned id (`subscriptions.ts:133-149`, `:167-181`). For update, `P0002` → `notFound` and every other error code → `save` (`:153,177-179`). The `chooseCategory` guard at `:131`/`:165` cannot be reached via the route, because the parser already enforces it (`:110`).
- **`create_subscription`** (`20261003140000…sql`):
  1. Raises `42501` when `auth.uid()` is null (`:27-29`).
  2. Resolves the category: select, else `insert … on conflict do nothing`, else re-select (`:31-56`).
  3. Inserts the subscription (`:58-60`).
  - It is one function and so one transaction. Any later error rolls back the category insert.
- **`update_subscription`** (`20261010120000…sql`):
  - Its category block is a copy of the one in create (`:57-84`). The comment on `:57-58` requires keeping the two identical.
  - It runs the `update … where id = p_id` and raises `P0002` when no row was returned (`:86-97`). That covers both "missing" and "another user's" ids, because the RLS `using` clause hides those rows (`:10-23`).
  - The column grant excludes `user_id` and `created_at` (`:5`).
- **Failures that can happen after the category insert inside one call.** Each of these is a candidate for "no category created, row identical":
  - a check violation on `subscriptions`: amount ≤ 0, name length, currency, cycle (`23514`);
  - an RLS `with check` failure: a category the caller cannot see (`42501`);
  - `P0002` on update with an unknown or foreign `p_id`. This path is not tested anywhere.
  - Validation failures in the app (invalid amount via the form) never reach the DB (`subscriptions.ts:84-88`). A test that sends them through the route proves only "no call was made", not rollback.
- **"Dropped connection."** postgrest-js turns a fetch failure into a resolved `{ error: { code: "" … } }` unless `throwOnError()` is used (`postgrest-js/dist/index.mjs:416-437`). An `AbortError` is re-thrown from the retry loop (`:210`) and then caught at `:416` with a hint. RPC uses POST (`:3983,3991`), and `RETRYABLE_METHODS` holds just `GET`, `HEAD`, `OPTIONS` (`:81-84`), so a failed save is not resent automatically.
  - A failure before the request reaches PostgREST can be simulated with a custom `fetch` passed to `createClient` (`global.fetch` option) or with an unreachable URL. Either way the service returns `save`.
  - A connection dropped *after* commit (the response is lost) shows the error although the row exists. A retry of the add then creates a duplicate subscription, because create is not idempotent: there is no client-supplied key (`create_subscription_rpc.sql:58-60`). This is the reverse of #4. Local tests cannot simulate it without a proxy (see Open Questions).

### 2. Success feedback and category reuse (#4)

- **Banners** are driven only by query parameters (`src/pages/subscriptions.astro:12-13`, rendered at `:41-45` and `:51-55`). `?error=` goes through the allowlist `displayableError` (`subscriptions.ts:52-59`). `saved` and `updated` have no equivalent check.
  - So "confirmation only when the row exists" holds for the route's own redirects (server-gated). It does not hold for the page in isolation.
  - A test of honest feedback must re-read persisted state (`listSubscriptions` / `getSubscription`) after a `{ ok: true }` and after a `{ ok: false }`, not just assert the redirect (`test-plan.md:57`).
- **Edit page**: an unknown id, or another account's id, redirects to `/subscriptions?error=notFound` (`src/pages/subscriptions/[id]/edit.astro:41-43`).
- **Category matching**, done in SQL only. The TS service sends the trimmed `newCategory` (`subscriptions.ts:98`):
  - normalisation: `nullif(btrim(p_new_category), '')`. `btrim` with no second argument strips spaces only, not tabs or NBSP (`create_subscription_rpc.sql:24`). JS `.trim()` in the parser already strips all Unicode whitespace first;
  - comparison: `lower(c.name) = lower(v_new_category)` against categories visible under RLS (starters + own), `order by c.user_id nulls first limit 1` (`:34-39`). So a starter wins over an own category with the same name;
  - creation: `insert … on conflict (user_id, (lower(name))) do nothing`, then re-select when there was a concurrent duplicate (`:42-54`);
  - the uniqueness backstop is index `categories_user_id_lower_name_key` (`20261003120000…sql:12-13`), plus the check `name = btrim(name)` (`:8`).
- **Not covered by any current check**:
  - `"  streaming "` → the starter "Streaming" is reused;
  - `"VIDEO"` after `"Video"` → the same own category;
  - the category count is unchanged after reuse.
  - The S-01 manual checks `Video`/`video` and `S%` (`context/archive/2026-10-02-first-subscription-on-list/plan.md:206,210`) were never automated. `rls-check.mjs:294-320` covers only the cross-account same-name case.
- **Behaviour no source pins down**:
  - Inner whitespace is not collapsed in any layer.
  - `lower()` on non-ASCII (e.g. Polish "Ł") depends on the database's ctype. I did not verify the local Supabase (PG 17, `supabase/config.toml:36`) locale.

### 3. Validation rules per layer (#6)

| Rule                | Form (`SubscriptionForm.tsx`)                                                | Server (`subscriptions.ts`)                     | Database                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| name required, ≤100 | `trim()`, `.length` (`:66-71`)                                               | `trim()`, `.length` (`:77-81`)                  | `name = btrim(name) and char_length between 1 and 100` (`20261003120000…sql:31`); RPC also `btrim(p_name)` (`create…sql:59`)         |
| amount format       | `AMOUNT_PATTERN` on trimmed (`:76-77`)                                       | same (`:83-86`)                                 | `numeric(10,2)` (`20261003120000…sql:32`)                                                                                            |
| amount > 0          | `Number(normaliseAmount) > 0` (`:78-79`)                                     | same (`:87-88`)                                 | `check (amount > 0)` (`:32`)                                                                                                         |
| currency            | not validated; `<select>` of `CURRENCIES` (`:145-150`)                       | `isOneOf(CURRENCIES)` (`:90-93`)                | `check (currency in ('PLN','EUR','USD'))` (`:33`)                                                                                    |
| cycle               | not validated; `<select>` of `CYCLES` (`:162-167`)                           | `isOneOf(CYCLES)` (`:95-96`)                    | `check (cycle in ('monthly','yearly'))` (`:34`)                                                                                      |
| new category ≤50    | `trim()`, `.length` when `__new__` selected (`:82-88`)                       | `trim()`, `.length` when non-empty (`:98-106`)  | `name = btrim(name) and char_length between 1 and 50` (`:8`)                                                                         |
| category chosen     | non-empty `categoryId` (`:89-91`)                                            | UUID pattern on `category_id` (`:109-110`)      | FK + RLS `with check` visible category (`:72-84`; update `20261010120000…sql:10-23`)                                                 |

- **Shared**: `SUBSCRIPTION_NAME_MAX_LENGTH`, `CATEGORY_NAME_MAX_LENGTH`, `AMOUNT_PATTERN`, `normaliseAmount`, `CURRENCIES`, `CYCLES` (`src/types.ts:3-48`).
- **Not shared**: the validation logic itself. The form's `validate()` is a closure inside the React component (`SubscriptionForm.tsx:63-95`) and cannot be called without rendering. Its messages differ from `SUBSCRIPTION_ERRORS` (no trailing period, and an extra "Amount is required"). A "same verdict in every layer" test therefore needs either a component render or extracting a pure validator. That is a plan decision.
- **Observed disagreements** (inferred from the code, not executed):
  - **Length unit.** JS `.length` counts UTF-16 code units. `char_length` counts code points. 50 emoji = 100 code units, so the app rejects what the DB accepts. The app is never more permissive, because code units ≥ code points.
  - **Amount input "00000000.01"** passes the pattern (8 integer digits). It is stored as 0.01, which is consistent.
  - **Amount max.** `99999999.99` is the maximum in both layers. 9 integer digits are rejected by the pattern in the app. In the DB they overflow `numeric(10,2)` (`22003`), which a direct RPC caller can hit.
  - **Direct RPC callers** can send >2 decimals. `numeric(10,2)` rounds them, so `0.004` → `0.00`, which then fails `amount > 0`. The app never sends this.
- **Source of cases.** The PRD gives only field names and "kwota, cykl i kategoria pozostają wymagane" (`context/foundation/prd.md:69-70`), with no boundaries. The concrete limits come from the S-01 plan (`context/archive/2026-10-02-first-subscription-on-list/plan.md:72,157`) and the currencies from `roadmap.md:133`. A "cases sourced from the PRD" table has to cite those docs for the boundaries.

### 4. Runner constraints

- **Code under test**:
  - `src/lib/services/subscriptions.ts`: pure TS, `@/` alias, takes a `SupabaseClient<Database>` as a parameter. An integration test can inject a real `@supabase/supabase-js` client signed in to local Supabase, as `scripts/rls-check.mjs:31-63` does.
  - `src/types.ts`: pure.
  - `SubscriptionForm.tsx`: React. Rendering it needs jsdom/happy-dom plus a React testing library, none of which is installed.
- **`astro:env/server`** is imported by `src/lib/supabase.ts:4`. API routes use `context.locals`, so a route can be tested by calling `POST` with a hand-built context object, without `astro:env`.
- **Candidates.**
  - Vitest via `getViteConfig` resolves `@/` and the `astro:*` virtual modules. Astro's own devDependency is `vitest ^4.1.11`; the npm latest is `5.0.5` (checked 2026-10-22).
  - `node:test` with Node 22 type stripping does not resolve the `tsconfig` `paths` alias without a loader. The choice is left to `/10x-plan`.
- **CI.** The `ci` job runs lint, format, `test:smoke`, `astro check` and build (`.github/workflows/ci.yml:27-35`). The `smoke` job starts local Supabase and runs `test:rls` and smoke (`:49-80`). Wiring a new test step is Phase 4 (`test-plan.md:75,119`), not Phase 2.

### 5. Existing coverage

- **`test:rls`** (`scripts/rls-check.mjs`):
  - a failed create with amount 0 and a new category leaves no orphan (`:168-181`);
  - B cannot use A's category via RPC (`:183-188`);
  - A's own update reads back the new values (`:204-219`);
  - B's update fails with `P0002`, and B's PATCH affects 0 rows; A is unchanged (`:221-238`);
  - `user_id` is immutable (`:240-241`);
  - a move into B's category is denied via RPC and via PATCH (`:255-271`);
  - a failed update with amount 0 and a new category leaves no category and an identical row (`:273-292`);
  - B's same-name category is B's own (`:294-320`).
- **`smoke`**: add and edit through the app with `__new__` categories (`scripts/smoke.mjs:144,178`) and cross-account isolation (AGENTS.md).
- **Not covered**:
  - `createSubscription`/`updateSubscription` error translation (`save`, `notFound`, network);
  - the `parseNewSubscription` case table;
  - reuse with different case or outer whitespace (starter and own);
  - rollback after `P0002`, or after the FK/RLS failure that follows a new-category insert;
  - the form's verdicts;
  - `?saved=1` without a row.

## Code References

- `src/lib/services/subscriptions.ts:38-59`: `SUBSCRIPTION_ERRORS`, `displayableError` allowlist
- `src/lib/services/subscriptions.ts:76-113`: `parseNewSubscription` (server rule set)
- `src/lib/services/subscriptions.ts:127-182`: `createSubscription` / `updateSubscription`, one RPC each, error mapping
- `src/types.ts:3-48`: shared constants, `AMOUNT_PATTERN`, `normaliseAmount`
- `src/components/subscriptions/SubscriptionForm.tsx:63-95`: form `validate()` (inline, re-implemented)
- `src/pages/api/subscriptions.ts:8-30`, `src/pages/api/subscriptions/[id].ts:13-43`: redirect contract
- `src/pages/subscriptions.astro:12-13,41-55`: banners driven only by the query string
- `supabase/migrations/20261003120000_subscriptions_and_categories.sql:8,12-13,31-34,72-84`: checks, unique index, insert policy
- `supabase/migrations/20261003140000_create_subscription_rpc.sql:24-60`: category resolution and insert in one function
- `supabase/migrations/20261010120000_update_subscription.sql:5,10-23,57-97`: grant, update policy, copied category block, `P0002`
- `scripts/rls-check.mjs:31-63,168-320`: client and sign-up helpers, existing DB-level atomicity and isolation checks
- `node_modules/@supabase/postgrest-js/dist/index.mjs:81-84,416-437`: no retry for POST, fetch errors resolve to `{ error }`

## Architecture Insights

- **Write paths.** Atomicity is a DB-function property, and the service is a thin translator. Phase 2's service-integration value is therefore in error translation and persisted-state re-reads. Re-proving the transaction is not the goal.
- **Category rule.** The reuse rule exists twice in SQL (create and update) with a "keep identical" comment. A shared case table run against both RPCs would catch drift between the copies.
- **Type and Result shapes.** The service already returns `Result`-shaped values and takes the client as a parameter, which makes it injectable without mocks. That matches the test-plan anti-pattern note ("do not mock the database client so every call succeeds", `test-plan.md:59`).

## Historical Context (from prior changes)

- `context/archive/2026-10-02-first-subscription-on-list/plan.md:158`: the original two-call write accepted orphan categories.
  - Verdict: **superseded** by impl-review F3 (`reviews/impl-review.md:65-73`), which introduced `create_subscription` and the `lessons.md` rule.
- `context/foundation/lessons.md:5-10`:
  - the rule ("atomic, all or nothing") is **supported** by the current code;
  - the anchor `subscriptions.ts:127` "create category → insert subscription" is **contradicted**, because line 127 is now the single-RPC `createSubscription`.
- `first-subscription-on-list/plan.md:158`: category matching via "trimmed input after `toLowerCase()` … never ilike".
  - Verdict: **partial**. The no-wildcard and case-insensitive parts hold in SQL (`create…sql:32-33`). The comparison moved from TS to SQL `lower()`/`btrim()`.
- `context/archive/2026-10-10-edit-subscription/plan.md:30,72`: the update must raise `P0002` itself and roll back a category created in the same call.
  - Verdict: **supported** (`20261010120000…sql:95-97`). The rollback is untested.
- `context/archive/2026-10-15-testing-safety-net-verification/plan-brief.md:23,45`: the `src/` runner ("likely Vitest") is deferred to Phase 2. The follow-up asks for middleware tests once a runner exists (`follow-ups/review-fixes.md:5`).

## Related Research

- `context/archive/2026-10-15-testing-safety-net-verification/research.md`: smoke and RLS step→assertion map (Phase 1)

## Decisions (2026-10-22, user)

Questions 1–5 below are settled. Question 6 and the locale check from question 3 remain inputs for `/10x-plan`.

1. **Form verdicts:** extract the form's `validate()` logic into a pure function in `src/lib/`. `SubscriptionForm` calls it, and the shared case table runs it alongside `parseNewSubscription` and the DB constraints. No component rendering, no jsdom or Testing Library.
2. **Crafted `?saved=1` / `?updated=1`:** out of Phase 2. Record it as a follow-up for a **separate change**. Phase 2 tests server-side honesty: re-read persisted state after every service result.
3. **Category whitespace:** keep the current rule (case-insensitive, outer whitespace trimmed). Tests assert reuse for a different case and for outer spaces, and pin inner double spaces as a boundary that creates a new category. No migration.
4. **Lost response after commit → duplicate on retry:** known gap, not tested in Phase 2. Follow-up: an idempotency key, in a separate change alongside decision 2.
5. **Runner:** Vitest **5.x** (latest checked 2026-10-22: `5.0.5`) for `src/`; `scripts/` stays on `node:test`. Astro's own devDependency is `vitest ^4.1.11`, so compatibility of 5.x with Astro 7's `getViteConfig` is unverified. The plan must prove it in its first phase (alias `@/` resolves, an `astro:env/server` import loads) before any tests are written on it.

## Open Questions

1. **Form verdicts in the shared case table.** Extract a pure `validateSubscriptionForm` (a code change in `src/`, small) or render the component (adds jsdom + Testing Library)? This is a product/scope choice for `/10x-plan`.
2. **Crafted `?saved=1`.** Is this in scope for #4, or accepted because a self-crafted link only misleads its author? If in scope, the remedy is a code change, not just a test.
3. **Inner whitespace and non-ASCII case folding** for category reuse. Is "Cloud  storage" meant to reuse "Cloud storage"? The risk text says "different case/whitespace", and the current code normalises outer whitespace only. The local DB ctype (affects `lower('Ł')`) is unverified. Run `show lc_ctype;` against local Supabase.
4. **Lost response after commit, then a duplicate on retry.** Not testable without a proxy. Accept as a known gap, or add idempotency (out of Phase 2 scope)?
5. **Runner**: Vitest (via `getViteConfig`, and which major) vs `node:test` + loader. The plan must decide. Vitest is the documented Astro path.
6. **Test isolation.** Integration tests sign up throwaway `@example.com` users like `rls-check` does and need a **local** Supabase only. Reuse the `LOCAL_HOSTS` guard (`rls-check.mjs:15`).
