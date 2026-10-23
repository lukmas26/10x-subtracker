# Test plan Phase 2 — Service logic coverage Implementation Plan

## Overview

This plan bootstraps a test runner for `src/` (Vitest 5) and adds tests for three risks from `context/foundation/test-plan.md`:

- **#2** — a failed edit save must leave the stored row and the categories unchanged;
- **#4** — "saved"/"updated" appears only when the row really exists, and an existing category typed with different case or outer spaces is reused;
- **#6** — one sourced case table yields the same verdict in the form, the server and the database, or a documented divergence.

Each new test is broken on purpose once to prove it can fail. Phase 2 of the test plan is then documented.

## Current State Analysis

Research: `context/changes/testing-service-logic-coverage/research.md`, including its **Decisions** section.

- **Writes.** Each write is one RPC call, so one transaction (`src/lib/services/subscriptions.ts:133,167`; `supabase/migrations/20261003140000_create_subscription_rpc.sql:24-60`; `20261010120000_update_subscription.sql:57-97`).
  - `test:rls` proves rollback for exactly one forced failure per RPC: amount 0 plus a new category (`scripts/rls-check.mjs:168-181,273-292`).
  - Not tested yet: service error translation (`save`, `notFound`, network) and the redirect contract.
- **Confirmation.** The routes redirect to `?saved=1` / `?updated=1` only after a no-error RPC result (`src/pages/api/subscriptions.ts:29`, `src/pages/api/subscriptions/[id].ts:42`).
- **Category reuse** lives in SQL only: `lower()` + `btrim()`, starters first (`create_subscription_rpc.sql:24,34-39`), plus a unique index on `(user_id, lower(name))`. No automated test covers it.
  - The local DB uses ICU `en_US.UTF-8`. `lower('ŁÓDŹ') = 'łódź'` returned `true` (checked 2026-10-22 via `docker exec supabase_db_10x-astro-starter psql`).
- **Validation** exists three times:
  - the form's inline `validate()` (`src/components/subscriptions/SubscriptionForm.tsx:63-95`);
  - the server's `parseNewSubscription` (`subscriptions.ts:76-113`);
  - the DB checks (`20261003120000_subscriptions_and_categories.sql:8,31-34`).
  - Only the constants are shared (`src/types.ts:3-48`).
- **Runner.** None is installed. Astro 7 requires Vite `^8.0.13` (8.3.1 installed). Vitest 5.0.5 accepts Vite `^6.4 || ^7 || ^8`, and `astro/config` exports `getViteConfig`.

## Desired End State

**Commands.** `npm test` runs the unit project with no services. `npm run test:integration` runs the integration project against local Supabase and exits non-zero when `SUPABASE_URL`/`SUPABASE_KEY` are missing or not local.

Both suites are green, and each of the following assertions was seen red once under a deliberate break, then reverted:

- the same verdict per case across validator, parser and RPC, or an explicitly documented divergence;
- the exact redirect plus a re-read of the persisted row after every success and failure;
- no category is created after a failed call;
- category reuse for case, outer spaces and Polish letters, with inner double spaces pinned as a new category.

Test plan §3/§4/§6.3/§6.4/§6.6 and `AGENTS.md` describe how to add such tests.

### Key Discoveries:

- `scripts/routes.test.mjs:8-20` treats **every** `.ts`/`.js` file under `src/pages/` as a route. Test files must not live there, so all tests go under a top-level `tests/` directory.
- Local sign-up returns a session immediately (`supabase/config.toml:209` `enable_confirmations = false`). `rls-check` relies on it (`scripts/rls-check.mjs:53-63`), and the integration helpers can do the same.
- postgrest-js resolves fetch failures to `{ error: { code: "" } }` and does not retry POST (`node_modules/@supabase/postgrest-js/dist/index.mjs:81-84,416`). A client with a rejecting `fetch` therefore exercises the network path deterministically.
- The parser trims before calling the RPC (`subscriptions.ts:98`). The SQL `btrim`/`lower` rule can only be proven by calling the RPC directly with raw input; the service path never sends untrimmed values.
- The route handlers use only `context.locals.{supabase,user}`, `context.request.formData()`, `context.params.id` and `context.redirect()` (`src/pages/api/subscriptions.ts:8-30`, `[id].ts:13-43`). A small fake context is enough.

## What We're NOT Doing

- Wiring `npm test` / `test:integration` into CI or a post-edit hook. That is test plan Phase 4 (`test-plan.md:75,119`).
- Fixing the crafted `?saved=1` / `?updated=1` banner. It is a follow-up for a **separate change** (Decision 2).
- Testing or fixing duplicate subscriptions after a lost response. It is a known gap, with an idempotency-key follow-up (Decision 4).
- Normalising inner whitespace in category names. The current rule stays, and the boundary is pinned by a test (Decision 3).
- Rendering React components. There are no jsdom/happy-dom or Testing Library dependencies (Decision 1).
- Re-testing what `test:rls` already proves: cross-account isolation, `user_id` immutability, and the amount-0 orphan checks.
- Middleware tests. That follow-up from Phase 1 can use the new runner later.
- Testing against hosted Supabase. Its locale may differ for Polish case folding.

## Implementation Approach

Bootstrap and prove the runner first, because Vitest 5 + `getViteConfig` with Astro 7 is unverified (Decision 5). Every later phase depends on it.

Then build the oracle-first case table. Expected verdicts come from the PRD, the S-01 plan, the roadmap and the schema, never from running the code under test. The integration tests use a real signed-in Supabase client injected into the service and the route handlers. The database is never mocked, and every assertion re-reads persisted state with a healthy client.

Finish with deliberate breaks, recorded in the same format as Phase 1 (`context/archive/2026-10-15-testing-safety-net-verification/break-catalogue.md`).

## Critical Implementation Details

- **Oracle rule.** When a run disagrees with the case table, investigate which source is right. Never edit the expected verdict to match the code. A real disagreement is either a documented divergence (with its reason) or a bug to raise with the user.
- **Fresh state per test.** Use throwaway `@example.com` users and unique names with a run id, as `rls-check` does, so tests never depend on order or on leftover rows. Do not run `supabase db reset` without asking the user, because it wipes local data.
- **Port check.** Before running integration tests or deliberate DB breaks, follow `AGENTS.md`: local Supabase is shared with the user's session.

## Phase 1: Runner bootstrap

### Overview

Install Vitest 5, configure it through Astro, split the unit and integration projects, add the local-only guard and the user helpers, and prove that the alias and `astro:env/server` both resolve.

### Changes Required:

#### 1. Dependency and scripts

**File**: `package.json`

**Intent**: Add Vitest 5 as a dev dependency, plus the scripts for each suite.

**Contract**:

- devDependency `vitest` `^5.0.5`;
- `"test": "vitest run --project unit"`;
- `"test:integration": "vitest run --project integration"`.

`test:smoke` and `test:rls` are unchanged.

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Build the config with `getViteConfig` from `astro/config`, so the `@/` alias and `astro:*` virtual modules resolve as they do in the app.

**Contract**: two projects.

- `unit`: `tests/unit/**/*.test.ts`, Node environment.
- `integration`: `tests/integration/**/*.test.ts`, Node environment, with a `globalSetup` that runs the local-only guard, and with sequential files, because they share one local DB.

If Vitest 5 cannot load through `getViteConfig`, stop and report to the user before falling back to Vitest 4.x. The fallback changes Decision 5.

#### 3. Integration helpers

**File**: `tests/helpers/supabase.ts` (new)

**Intent**: A typed port of the `rls-check` patterns, for reuse by every integration test.

**Contract**:

- `assertLocalSupabase()`: throws with a clear message when the env is missing or the host is not one of `127.0.0.1`/`localhost`/`[::1]`. It mirrors `scripts/rls-check.mjs:8-25`.
- `newClient(options?)`: a `SupabaseClient<Database>`, optionally with a custom `fetch`.
- `signUpUser(label)`: signs up a throwaway user and returns `{ client, userId }`. It fails loudly when no session comes back.
- `runId`: a per-run unique suffix.

**File**: `tests/helpers/api-context.ts` (new)

**Intent**: A minimal fake `APIContext` for calling the `POST` handlers directly.

**Contract**: `makeContext({ supabase, user, form, params? })` provides `locals`, `request` (a POST with a `FormData` body), `params`, and `redirect(path)`, which returns a 302 `Response` with `Location`. A helper `redirectTarget(response)` returns `{ path, params }` parsed from `Location`.

#### 4. Probe tests

**File**: `tests/unit/runner.test.ts`, `tests/integration/runner.test.ts` (new)

**Intent**: Prove the runner wiring before real tests depend on it.

**Contract**:

- The unit probe imports a value through `@/` (e.g. `CURRENCIES` from `@/types`).
- The unit probe also imports `@/lib/supabase`, which imports `astro:env/server`, and asserts `createClient` is a function.
- The integration probe signs up one user and reads the starter categories (exactly 8, from `20261003120000…sql:15-23`).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the alias and `astro:env/server` probe
- `npm run test:integration` passes against local Supabase
- `npm run test:integration` with `SUPABASE_URL` unset exits non-zero with the guard's message
- `npm run lint`, `npx astro check`, `npm run format:check` and `npm run test:smoke` pass

#### Manual Verification:

- The user confirms that the port/server check was done before running the integration suite, and that it reused their local Supabase without interfering

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: One rule set (#6)

### Overview

Pull the form's validation out into a plain function. Write one case table with a source for each case, then run it against the validator and the parser (unit tests) and against `create_subscription` (integration tests).

### Changes Required:

#### 1. Pure form validator

**File**: `src/lib/services/subscription-validation.ts` (new), `src/components/subscriptions/SubscriptionForm.tsx`

**Intent**: Move the body of `validate()` into a pure function with unchanged behaviour and messages, so it is testable without rendering. The form calls it and keeps `setErrors`. The file imports only from `@/types`, so the client bundle stays safe (see the comment at `src/types.ts:38-39`).

**Contract**:

- `validateSubscriptionForm(values: { name; amount; categoryId; newCategory; isNewCategory }): Errors`, where `Errors` is the existing `Partial<Record<"name" | "amount" | "category" | "newCategory", string>>`. It is exported along with the function.
- The form's field messages stay byte-identical.

#### 2. Case table

**File**: `tests/cases/subscription-cases.ts` (new)

**Intent**: The single oracle for #6. Each row cites its source:

- `prd.md:69-70` for the required fields;
- `context/archive/2026-10-02-first-subscription-on-list/plan.md:72,157` for the limits;
- `roadmap.md:133` for the currencies;
- the migration line for each DB check.

**Contract**: each row has:

- `id`, `field`, `input` (the raw form values);
- `verdict: "accept" | "reject"`;
- optional `db: { verdict, code? , reason }` when the DB layer differs or needs a specific code;
- `dbApplicable: boolean`, false for app-only inputs such as a missing field in the form.

Rows include at least:

| Field    | Inputs and expected verdicts                                                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name     | `""`, `"   "` reject; `" Netflix "` accept (stored trimmed); 100 chars accept; 101 chars reject (DB `23514`)                                                                                                                                                          |
| Amount   | `"0"`, `"0.00"` reject (DB `23514`); `"0.01"` accept; `"49,99"` accept (DB receives 49.99); `"99999999.99"` accept; `"100000000"` reject (DB `22003`); `"abc"` reject (DB `22P02`); `"1.999"` app reject, DB accept after rounding to 2.00 (documented: the app is the guard) |
| Currency | `"GBP"`, `"pln"` reject (DB `23514`)                                                                                                                                                                                                                                  |
| Cycle    | `"weekly"` reject (DB `23514`)                                                                                                                                                                                                                                        |
| Category | new category of 50 chars accept; 51 chars reject (DB `23514`, rolled back); 50 emoji app reject, DB accept (documented: UTF-16 `.length` vs `char_length`); no category reject (DB `23502`)                                                                          |

DB codes come from the schema. If a run shows a different code, apply the oracle rule in Critical Implementation Details.

#### 3. Unit tests

**File**: `tests/unit/subscription-rules.test.ts` (new)

**Intent**: Run every row through `validateSubscriptionForm` and `parseNewSubscription`, and assert that both match `verdict`. The validator has no currency/cycle checks, because those are select-only. Its rows are asserted as "not rejected by the form", with that reason in the table. The test must not re-implement any rule.

**Contract**: one `it.each` per layer over the table, with the row `id` in the test name.

#### 4. DB-layer integration test

**File**: `tests/integration/subscription-rules.db.test.ts` (new)

**Intent**: For each `dbApplicable` row, call `create_subscription` directly as a signed-in user with the raw value (bypassing the parser).

**Contract**:

- Accepted → an id is returned, and the re-read row has the expected stored values.
- Rejected → the exact error code, and no subscription and no new category exist for that run's unique name.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, with the case table executed against both the validator and the parser
- `npm run test:integration` passes, with the DB verdicts for every `dbApplicable` row
- `npm run lint`, `npx astro check`, `npm run lint:ui`, `npm run format:check` and `npm run build` pass

#### Manual Verification:

- In the dev server, the add and edit forms show the same client-side messages as before the extraction (empty name, `abc` amount, empty new category)
- The user reviews the case table's divergence rows (`1.999`, emoji) and their documented reasons

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Atomic writes and honest feedback (#2, #4)

### Overview

Integration tests for `createSubscription`/`updateSubscription` and both `POST` handlers, with a real signed-in client. Every assertion re-reads the persisted state.

### Changes Required:

#### 1. Service integration tests

**File**: `tests/integration/subscriptions.service.test.ts` (new)

**Intent**: Prove that the Result values are honest and that a failure leaves the data unchanged.

**Contract**: cases:

- **Create success** → `{ ok: true }`, and `listSubscriptions` contains exactly one row with the sent values (amount as exact text).
- **Create into another user's private category** → `{ ok: false, error: SUBSCRIPTION_ERRORS.save }`, with no row added.
- **Create with an unknown category UUID** → `save`, with no row added.
- **Update success** → `{ ok: true }`, and `getSubscription` returns the new values.
- **Update, failure after a category insert in the same call:**
  - new category plus `amount: "0"` passed directly to the service → `save`;
  - new category plus an unknown or another user's id → `notFound`.
  - In both, the row is identical to its pre-call snapshot and the run's new category name does not exist.
- **Network failure** (client with a rejecting `fetch`) → `save` for both create and update. Re-reading with a healthy client shows no change.

#### 2. Route handler integration tests

**File**: `tests/integration/subscriptions.routes.test.ts` (new)

**Intent**: Prove the mapping from the service result to the redirect, which decides whether the success banner appears, against the persisted state.

**Contract**: call the `POST` handlers from `src/pages/api/subscriptions.ts` and `src/pages/api/subscriptions/[id].ts` with `makeContext`. Assert the exact `Location` path and query:

| Scenario                         | Expected redirect                                                                    | Re-read check                                      |
| -------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Add, valid                       | `/subscriptions?saved=1`                                                             | row exists                                         |
| Add, invalid amount              | `/subscriptions?error=<amountFormat>` with no `saved`                                | no row                                             |
| Add, DB failure                  | `?error=<save>` with no `saved`                                                      | no row, no category                                |
| Edit, valid                      | `/subscriptions?updated=1`                                                           | new values                                         |
| Edit, invalid amount             | `/subscriptions/<id>/edit?error=<amountFormat>`                                      | row unchanged                                      |
| Edit, another user's id          | `/subscriptions?error=<notFound>`                                                    | both rows unchanged                                |
| Edit, malformed id               | `/subscriptions?error=<notFound>`                                                    | —                                                  |
| Edit, network failure            | edit page `?error=<save>`                                                            | row unchanged                                      |
| No user                          | `/auth/signin`                                                                       | —                                                  |
| Null client                      | `?error=<notConfigured>`                                                             | —                                                  |

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes, including the service and route suites
- `npm test`, `npm run lint`, `npx astro check` and `npm run format:check` pass
- `npm run test:rls` still passes (no interference with shared local data)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Category reuse (#4)

### Overview

Pin the category-matching rule through both RPCs, and once through the service, with category counts read back.

### Changes Required:

#### 1. Category reuse integration tests

**File**: `tests/integration/category-reuse.test.ts` (new)

**Intent**: Prove that an existing category typed differently is reused rather than duplicated, that a starter wins over an own category, and that the inner-whitespace boundary holds (Decision 3).

**Contract**: run each case against `create_subscription` **and** `update_subscription`, called directly with the raw `p_new_category`. Assert the resulting `category_id` and the caller's own-category count before and after:

- `"  streaming "` and `"STREAMING"` → the starter "Streaming" id; own count unchanged;
- own `"Video"` exists, then `"VIDEO"` / `" video "` → the same id; count unchanged;
- own `"ŁÓDŹ"` exists, then `"łódź"` → the same id (local ICU locale, see Current State);
- own `"Cloud storage"` exists (named so that no starter matches), then `"Cloud  storage"` → a **new** category; count +1 (the pinned boundary);
- `"S%"` → a new category, not Streaming (no wildcard; S-01 manual check `first-subscription-on-list/plan.md:210`).

One extra case through `createSubscription` checks that the service path inherits the rule: `newCategory: "video"` → the existing own "Video".

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` passes, including the category-reuse suite for both RPCs
- `npm test`, `npm run lint`, `npx astro check` and `npm run format:check` pass

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Prove and document

### Overview

Break each guarded behaviour once on purpose, confirm the matching test goes red, then revert. Record the results and update the docs the test plan points to.

### Changes Required:

#### 1. Deliberate breaks

**File**: `context/changes/testing-service-logic-coverage/break-catalogue.md` (new)

**Intent**: Prove that every new test can fail. Apply each break by hand, run the suite, record the red test name and output excerpt, then revert and confirm green. Use the Phase 1 catalogue format.

**Contract**: one row per break, at least:

1. `createSubscription` returns `{ ok: true }` despite `error` → service and route "DB failure" tests red.
2. The add route redirects to `?saved=1` before checking `result.ok` → route test red.
3. `updateSubscription` maps `P0002` to `save` → the `notFound` service and route tests red.
4. `parseNewSubscription` compares the name with `SUBSCRIPTION_NAME_MAX_LENGTH + 1`, so 101 characters are accepted → case table red on the parser layer (101-char row).
5. `validateSubscriptionForm` drops the `> 0` amount check → case table red on the form layer.
6. On local DB only, `create or replace` `create_subscription` with `c.name = v_new_category` instead of `lower()` equality → category-reuse red for create. Revert by re-running the original function body from the migration file, not `db reset`.
7. Same for `update_subscription` → category-reuse red for update. This proves the copied block is guarded in both RPCs.

#### 2. Test plan and agent docs

**File**: `context/foundation/test-plan.md`

**Intent**: Record what Phase 2 shipped, so the next contributor follows the pattern.

**Contract**:

- §3: Phase 2 Status → `complete`.
- §4: replace the "none yet" row with Vitest 5 + `getViteConfig`, `npm test` / `npm run test:integration`.
- §6.3: fill "Adding a service integration test" (fake context, snapshot then re-read, failure after a category insert, network fetch).
- §6.4: fill "Adding a validation rule across form, server, and database" (case table with sources, divergence rows, oracle rule).
- §6.6: append a Phase 2 note.

Do not change §1–§2 risks or §5 gates; that belongs to the test plan skill.

**File**: `AGENTS.md`

**Intent**: Add the two commands to `## Commands`. Mention `tests/` (never under `src/pages/`, because of the route inventory), and that `src/lib/services/subscription-validation.ts` is the form's validator.

**Contract**: `## Commands` and `## Conventions` bullets only.

**File**: `context/foundation/lessons.md`

**Intent**: Correct the stale anchor. The rule text stays.

**Contract**: the Context line points to `supabase/migrations/20261003140000_create_subscription_rpc.sql` (fixed via a single-RPC transaction) instead of "`subscriptions.ts:127` (create category → insert subscription)".

#### 3. Follow-ups

**File**: `context/changes/testing-service-logic-coverage/follow-ups.md` (new)

**Intent**: Record the decided separate changes, so they are not lost.

**Contract**: two entries with their evidence (research §2 and §1):

- crafted `?saved=1` / `?updated=1` shows a confirmation without a row;
- a lost response after commit leads to a duplicate on retry, so an idempotency key is needed.

### Success Criteria:

#### Automated Verification:

- After every revert: `npm test` and `npm run test:integration` pass
- `npm run test:smoke`, `npm run test:rls`, `npm run lint`, `npx astro check`, `npm run format:check` and `npm run build` pass
- `git diff --stat` shows no leftover break in `src/` or `supabase/migrations/`

#### Manual Verification:

- The user reviews `break-catalogue.md`: every break was red and reverted
- The user reviews the test-plan §6.3/§6.4 cookbook text and the `follow-ups.md` entries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- The case table against `validateSubscriptionForm` and `parseNewSubscription` (boundaries 100/101, 50/51, amount 0/0.01/99999999.99/100000000, separators, enums)
- The runner probe for the alias and `astro:env/server`

### Integration Tests:

- The case table against `create_subscription` (exact codes, no row, no category)
- Service and route honesty: the exact redirect plus re-read after success, DB failure, failure after a category insert, `P0002`, and network failure
- Category reuse through both RPCs, plus one service-path case

### Manual Testing Steps:

1. Start the dev server after the port check and submit the add form with an empty name, `abc` as amount, and an empty new category. Messages match the pre-extraction text.
2. Review the divergence rows and `break-catalogue.md`.

## Performance Considerations

Integration files run sequentially against one local DB. They create a few users and rows per run, with no cleanup needed, as with `rls-check`. The expected runtime is seconds. Not a gate yet.

## Migration Notes

None. No schema changes. Phase 5 breaks DB functions only temporarily on local Supabase and restores them from the migration source.

## References

- Research and decisions: `context/changes/testing-service-logic-coverage/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#2, #4, #6), §3 Phase 2, §6
- Patterns: `scripts/rls-check.mjs:8-63` (local guard, sign-up), `context/archive/2026-10-15-testing-safety-net-verification/break-catalogue.md` (break format)
- Limits source: `context/archive/2026-10-02-first-subscription-on-list/plan.md:72,157,206,210`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner bootstrap

#### Automated

- [x] 1.1 `npm test` passes, including the alias and `astro:env/server` probe — 2b77698
- [x] 1.2 `npm run test:integration` passes against local Supabase — 2b77698
- [x] 1.3 `npm run test:integration` with `SUPABASE_URL` unset exits non-zero with the guard's message — 2b77698
- [x] 1.4 `npm run lint`, `npx astro check`, `npm run format:check` and `npm run test:smoke` pass — 2b77698

#### Manual

- [x] 1.5 The user confirms that the port/server check was done before running the integration suite, and that it reused their local Supabase without interfering — 2b77698

### Phase 2: One rule set (#6)

#### Automated

- [x] 2.1 `npm test` passes, with the case table executed against both the validator and the parser — 8aee5b7
- [x] 2.2 `npm run test:integration` passes, with the DB verdicts for every `dbApplicable` row — 8aee5b7
- [x] 2.3 `npm run lint`, `npx astro check`, `npm run lint:ui`, `npm run format:check` and `npm run build` pass — 8aee5b7

#### Manual

- [x] 2.4 In the dev server, the add and edit forms show the same client-side messages as before the extraction (empty name, `abc` amount, empty new category) — 8aee5b7
- [x] 2.5 The user reviews the case table's divergence rows (`1.999`, emoji) and their documented reasons — 8aee5b7

### Phase 3: Atomic writes and honest feedback (#2, #4)

#### Automated

- [x] 3.1 `npm run test:integration` passes, including the service and route suites — af49738
- [x] 3.2 `npm test`, `npm run lint`, `npx astro check` and `npm run format:check` pass — af49738
- [x] 3.3 `npm run test:rls` still passes (no interference with shared local data) — af49738

### Phase 4: Category reuse (#4)

#### Automated

- [x] 4.1 `npm run test:integration` passes, including the category-reuse suite for both RPCs
- [x] 4.2 `npm test`, `npm run lint`, `npx astro check` and `npm run format:check` pass

### Phase 5: Prove and document

#### Automated

- [ ] 5.1 After every revert: `npm test` and `npm run test:integration` pass
- [ ] 5.2 `npm run test:smoke`, `npm run test:rls`, `npm run lint`, `npx astro check`, `npm run format:check` and `npm run build` pass
- [ ] 5.3 `git diff --stat` shows no leftover break in `src/` or `supabase/migrations/`

#### Manual

- [ ] 5.4 The user reviews `break-catalogue.md`: every break was red and reverted
- [ ] 5.5 The user reviews the test-plan §6.3/§6.4 cookbook text and the `follow-ups.md` entries
