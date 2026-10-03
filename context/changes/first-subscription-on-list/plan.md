# First Subscription on List Implementation Plan

## Overview

Roadmap S-01 (north star). A signed-in user adds a subscription — name, amount, currency, monthly/yearly cycle, and a category picked from a list or created on the spot — on a new protected `/subscriptions` page and immediately sees it on their own list. This change introduces the first table holding financial data and the first row-level security policies, so it also proves — in CI on every run and at the API level — that a second account cannot see or write someone else's subscriptions.

## Current State Analysis

- No schema exists: `supabase/` holds only `config.toml` (seed file path `./seed.sql`, `config.toml:65`; Postgres 17, `config.toml:36`). No `supabase/migrations/`, no `src/lib/services/`, no `src/types.ts` (AGENTS.md names both as their future homes).
- Auth API routes read `formData()` and answer with redirects; errors travel as `?error=<message>` (`src/pages/api/auth/signin.ts:5-19`). React forms validate client-side and then submit natively (`src/components/auth/SignInForm.tsx:36-43`) using reusable `FormField`, `ServerError`, `SubmitButton` (`src/components/auth/*.tsx`).
- `createClient()` returns `null` when Supabase env is unset (`src/lib/supabase.ts:6-8`); every caller handles that. It is untyped — no `Database` generic — so query results are `any`, which `strictTypeChecked` lint rejects once real tables are queried.
- `src/middleware.ts:4` protects only `/dashboard` (starter placeholder, `src/pages/dashboard.astro`). Sign-in lands on `/` (`signin.ts:19`). `Topbar.astro:10` links to `/dashboard`.
- `scripts/smoke.mjs` runs 8 local steps (fresh `@example.com` sign-up each run) or 7 remote steps (fixed confirmed test account, +1 Access check); `scripts/smoke-match.mjs` matches status + exact redirect path + `?error` presence, with `node:test` tests. CI runs both the matcher tests and a local-Supabase smoke (`.github/workflows/ci.yml:21,40-54`).
- F-01 is done: previews are behind Cloudflare Access, but **preview and production share the hosted database** (per-version secrets). `context/plans/deployment-plan.md` `## Release runbook` (line 261) is the release path.

## Desired End State

- A signed-in user opens `/subscriptions`, fills in name, amount (e.g. `49,99` or `49.99`), currency (PLN default, EUR, USD), cycle (monthly/yearly) and a category (starter list, their own categories, or a new name typed on the spot), submits, and lands back on `/subscriptions` with a "Subscription saved" confirmation and the new entry at the top of the list showing name, `49.99 PLN`, cycle and category.
- Invalid input is rejected client-side; anything the server rejects comes back as a visible `?error=` message and nothing is written.
- An anonymous visitor to `/subscriptions` is redirected to `/auth/signin`.
- Account B never sees account A's subscriptions or user categories — through the page or directly through the Supabase REST API with the public anon key — and cannot insert rows owned by A or pointing at A's category. `npm run test:rls` and the local smoke both prove it in CI.
- The migration is applied to hosted Supabase, a version is verified on the Access-protected preview and on production via `npm run smoke:remote`, and the runbook records it.

### Key Discoveries:

- `src/pages/api/auth/signin.ts:9-12` — the `null`-client branch pattern every new route/page must copy.
- `scripts/smoke.mjs:51-66` — all requests go through one `request()` helper returning `{status, location}`; body checks plug in there. Sign-out expires the session cookies (`storeCookies` drops `max-age=0`), so account B can reuse the same jar after sign-out.
- `scripts/smoke-match.mjs:10-25` — pure matcher; `error: true` / absent `error` already distinguishes failure vs success redirects, so `?saved=1` passes as a success redirect.
- `eslint.config.js:73-76` — `scripts/**/*.mjs` have an explicit globals list; a new script using other globals must extend it.
- `supabase/config.toml:209` — local `enable_confirmations = false`, so local sign-up yields an immediately usable session (the RLS check and smoke rely on this; hosted does not allow it).

## What We're NOT Doing

- Editing or deleting subscriptions (S-02, S-03): no `update`/`delete` RLS policies on `subscriptions` yet — least privilege until those slices add them.
- Spending totals or currency conversion (S-04); no exchange rates. Amounts are stored as entered, in their own currency.
- Currencies beyond PLN, EUR, USD.
- Admin role, shared admin-curated catalog (FR-005), auto-categorisation (FR-008); renaming or deleting user categories.
- Changing `/dashboard`, the post-sign-in redirect (`/`), or any auth route.
- Writing subscriptions during `smoke:remote` — remote mode stays read-only so no test data accumulates in production; production write/isolation is checked manually once on the preview.
- Running `test:rls` against hosted Supabase (it signs up throwaway users, which hosted confirmation blocks and which would pollute production).
- Pagination, sorting controls, search.

## Implementation Approach

Database first: one migration creates `categories` (starter rows owned by nobody, user rows owned by their creator) and `subscriptions`, with explicit grants and per-operation RLS. Generated `Database` types make the Supabase client typed. A dependency-free-ish script (`@supabase/supabase-js` is already a dependency) attacks the policies through the REST API as two real users. Then one vertical slice: a service module owns validation, category reuse/creation and listing; a thin `POST /api/subscriptions` route follows the auth-route redirect pattern; an Astro page renders the list server-side and hosts a React form island. Finally the smoke test learns body checks and gains the add + cross-account steps, and the release follows the existing runbook with the migration applied first.

## Critical Implementation Details

- **Migration before preview, additive only.** Preview and production share the hosted database, so `npx supabase db push` must run before verifying the preview. The migration only creates new objects, so the currently promoted version (which never touches them) keeps working.
- **Category ownership in the insert policy.** The `subscriptions` insert `WITH CHECK` must verify both `user_id = auth.uid()` and that `category_id` refers to a category with `user_id IS NULL OR user_id = auth.uid()`; otherwise B can attach a subscription to A's private category (and learn its id is valid). `categories` insert must require `user_id = auth.uid()` so nobody can create a starter (ownerless) row.
- **Explicit grants.** Do not rely on Supabase's default exposure of new `public` tables: grant `select, insert` on both tables to `authenticated` only; `anon` gets nothing.
- **Starter categories live in the migration, not `seed.sql`.** `seed.sql` runs only on local `db reset`; hosted needs the rows from `db push`.
- **Typed client.** Pass the generated `Database` type to `createServerClient<Database>()`; without it `strictTypeChecked` fails on `any` rows.

## Phase 1: Schema, RLS and policy check

### Overview

Create the data model with row-level security, typed access, and an automated proof that policies isolate accounts at the REST API level.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_subscriptions_and_categories.sql`

**Intent**: Create the two tables, starter categories, grants and RLS policies in one additive migration.

**Contract**:
- `categories`: `id uuid pk default gen_random_uuid()`, `user_id uuid null references auth.users on delete cascade` (null = starter), `name text not null` (trimmed, 1–50 chars check), `created_at timestamptz default now()`; unique index on `(user_id, lower(name)) nulls not distinct`.
- Starter rows (`user_id` null): Streaming, Music, Software & tools, Cloud storage, News & media, Gaming, Fitness, Other.
- `subscriptions`: `id uuid pk`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `name text not null` (trimmed, 1–100 chars check), `amount numeric(10,2) not null check (amount > 0)`, `currency text not null default 'PLN' check (currency in ('PLN','EUR','USD'))`, `cycle text not null check (cycle in ('monthly','yearly'))`, `category_id uuid not null references categories` (default `NO ACTION`, not `RESTRICT`: `RESTRICT` is checked immediately and can abort the `auth.users` cascade that deletes a user's categories and subscriptions together), `created_at timestamptz not null default now()`; index on `(user_id, created_at desc)`.
- RLS enabled on both. Policies, role `authenticated` only:
  - `categories` select: `user_id is null or user_id = auth.uid()`; insert with check: `user_id = auth.uid()`.
  - `subscriptions` select: `user_id = auth.uid()`; insert with check: `user_id = auth.uid()` and the referenced category is visible to the caller (starter or own).
- `grant select, insert` on both tables to `authenticated`; nothing to `anon`.

#### 2. Generated database types and typed client

**File**: `src/db/database.types.ts` (generated), `src/lib/supabase.ts`, `package.json`, `eslint.config.js`, `.prettierignore` (new)

**Intent**: Make Supabase queries typed so strict lint passes and DTOs derive from the schema, without lint or the pre-commit hook rewriting the generated file.

**Contract**: generated by a new `npm run db:types` script (`supabase gen types typescript --local > src/db/database.types.ts`), checked in; `createClient` returns `SupabaseClient<Database> | null` via `createServerClient<Database>(…)`. The null-on-missing-env behaviour is unchanged. `src/db/database.types.ts` is listed in the ESLint ignores and in `.prettierignore` — otherwise `stylisticTypeChecked` (`consistent-type-definitions`) and `eslint-plugin-prettier` fail on the generated output and lint-staged's `eslint --fix` reformats it, so regeneration would always show a diff.

#### 3. Shared DTOs

**File**: `src/types.ts`

**Intent**: Entity/DTO types the service, route and components share.

**Contract**: `Currency = "PLN" | "EUR" | "USD"`, `Cycle = "monthly" | "yearly"`, `CURRENCIES`, `CYCLES` constant arrays; `CategoryDTO { id, name, isStarter }`; `SubscriptionListItemDTO { id, name, amount: string, currency, cycle, categoryName, createdAt }` (amount kept as the exact decimal string, never a float).

#### 4. RLS check script

**File**: `scripts/rls-check.mjs`, `package.json`, `eslint.config.js`

**Intent**: Prove isolation through the same REST API an attacker would use with the public anon key.

**Contract**: `npm run test:rls` (`node scripts/rls-check.mjs`), reads `SUPABASE_URL`/`SUPABASE_KEY` from env, exits 1 if unset. Signs up two fresh `@example.com` users (A, B) with separate clients, then asserts and prints PASS/FAIL per check, exiting non-zero on any failure:
- A creates a category and a subscription (in A's category) — succeeds.
- B selecting `subscriptions` returns 0 rows; B selecting `categories` returns only starter rows (not A's).
- B inserting a subscription with `user_id = A` fails; B inserting a subscription with A's `category_id` fails; B inserting a category with `user_id` null fails.
- B updating or deleting A's subscription affects 0 rows; A still sees exactly its one subscription.
- An unauthenticated (anon) client sees 0 subscriptions and 0 categories.
Extend the scripts globals block only if the script needs more globals.

#### 5. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Run the policy check on every push/PR against the local Supabase the smoke job already starts.

**Contract**: in the `smoke` job, after the `.env` step: `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY npm run test:rls` (sourcing `supabase.env`). The `supabase start -x …` exclusions stay valid (REST + auth are kept).

#### 6. Agent docs

**File**: `AGENTS.md`

**Intent**: Record the new commands and conventions.

**Contract**: Commands gain `npm run test:rls` (needs a local Supabase; never against hosted) and `npm run db:types`; Conventions note that `src/db/database.types.ts` is generated and must be regenerated after each migration; drop "(neither exists yet)" for services/types as they come to exist.

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean local DB: `npx supabase db reset`
- Generated types are current: re-running the type generation produces no diff in `src/db/database.types.ts`
- RLS check passes against local Supabase: `npm run test:rls`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- In local Studio (or `psql`), `categories` shows the 8 starter rows with `user_id` null and both tables show RLS enabled with only the listed policies

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service, API and /subscriptions page

### Overview

Deliver the user-visible flow: protected page with add form and own list, backed by a service and a redirect-style API route.

### Changes Required:

#### 1. Subscription service

**File**: `src/lib/services/subscriptions.ts`

**Intent**: Single owner of input validation, category resolution and listing, so the route and page stay thin.

**Contract**:
- `parseNewSubscription(form: FormData)` → `{ ok: true, value } | { ok: false, error: string }`. Rules: `name` trimmed 1–100; `amount` matches `^\d{1,8}([.,]\d{1,2})?$`, comma normalised to dot, > 0; `currency` ∈ `CURRENCIES`; `cycle` ∈ `CYCLES`; category = non-empty trimmed `new_category` (1–50) if present, otherwise `category_id` (uuid) required. Error strings are user-facing English.
- `createSubscription(supabase, userId, input)` — if `new_category` given: reuse a visible category (starter or own) whose name equals the trimmed input after `toLowerCase()` on both sides — an exact comparison against the loaded visible categories, never `ilike`/`like` (their `%`/`_` wildcards would make `S%` reuse "Streaming") — else insert one for the user (on unique violation `23505`, re-select and reuse); then insert the subscription. Returns `{ ok } | { ok: false, error }`; database errors are logged with `console.error` (Supabase error `code` and `message` only, never form values) so they show in Worker logs / `wrangler tail`, then map to a generic "Could not save the subscription. Please try again." (no partial writes are user-visible: a failed subscription insert after a category insert leaves only a harmless reusable category).
- `listSubscriptions(supabase)` → `SubscriptionListItemDTO[]` ordered `created_at desc` (RLS scopes rows; joined category name).
- `listCategories(supabase)` → `CategoryDTO[]`, starters first then own, each alphabetical.

#### 2. API route

**File**: `src/pages/api/subscriptions.ts`

**Intent**: Accept the form post and answer with redirects, mirroring the auth routes.

**Contract**: `POST` only. No client → redirect `/subscriptions?error=Supabase is not configured`; no `locals.user` → redirect `/auth/signin`; validation or save error → redirect `/subscriptions?error=<encoded message>`; success → redirect `/subscriptions?saved=1`. Uses `context.redirect` (302), like the auth routes.

#### 3. Route protection and navigation

**File**: `src/middleware.ts`, `src/components/Topbar.astro`

**Intent**: Protect the new page and make it reachable.

**Contract**: `PROTECTED_ROUTES` becomes `["/dashboard", "/subscriptions"]` (the API route checks the user itself). Topbar signed-in links gain "Subscriptions" → `/subscriptions` before "Dashboard".

#### 4. Page

**File**: `src/pages/subscriptions.astro`

**Intent**: Server-render the user's list and host the form island, in the existing glass/cosmic style and usable at phone width.

**Contract**: reads `saved` / `error` search params; loads categories + subscriptions via the service (if client is `null`, show the config banner path from `Layout` and an empty state, no crash). Shows: Topbar; a "Subscription saved" confirmation when `saved=1`; `<SubscriptionForm categories={…} serverError={error} client:load />`; the list (name, `amount currency`, "monthly"/"yearly", category) or an empty state "No subscriptions yet — add your first one above." Single-column layout below `sm`.

#### 5. Form island

**File**: `src/components/subscriptions/SubscriptionForm.tsx` (+ hooks in `src/components/hooks/` only if extracted)

**Intent**: Client-side validation with the same rules as the server, then native submit to `/api/subscriptions`.

**Contract**: fields `name`, `amount` (`inputMode="decimal"`), `currency` select (default PLN), `cycle` (monthly default / yearly), `category_id` select listing categories plus a final "+ New category…" option that reveals a `new_category` text input (when chosen, `category_id` is not required). Reuses `FormField`, `ServerError`, `SubmitButton` (pending text "Saving..."). `noValidate` + per-field errors, same pattern as `SignInForm`. Shared validation regex/limits come from one place (exported from the service module or `src/types.ts` constants) — not duplicated literals.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build passes: `npm run build`
- Existing local smoke still passes 8/8 against `npm run preview` + local Supabase: `npm run smoke`

#### Manual Verification:

- Signed in locally: adding "Netflix", `49,99`, PLN, monthly, Streaming shows "Subscription saved" and the row `49.99 PLN · monthly · Streaming` at the top
- Choosing "+ New category…" with `Video` creates and uses it; adding another with `video` reuses the same category (appears once in the select)
- Empty name, `0`, `abc`, `1.999` are blocked client-side with field errors; a crafted bad post (e.g. curl with `currency=GBP`) returns to the page with a visible error and writes nothing
- Anonymous `/subscriptions` redirects to `/auth/signin`; a second local account sees an empty list
- Page is usable at ~375px width (no horizontal scroll, form controls reachable)
- A new category named `S%` is created as its own category and does not reuse "Streaming"

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Smoke coverage for add and cross-account isolation

### Overview

Make the end-to-end smoke prove the add flow and that a second account cannot see the first account's subscription, locally and in CI; remote mode gains read-only coverage.

### Changes Required:

#### 1. Body expectations in the matcher

**File**: `scripts/smoke-match.mjs`, `scripts/smoke-match.test.mjs`

**Intent**: Allow a step to assert the response body contains / does not contain a string, keeping the matcher pure.

**Contract**: `actual` gains optional `body: string`; `expected` gains optional `bodyIncludes?: string`, `bodyExcludes?: string`, checked after status/redirect rules (missing body with a body expectation → false). Tests cover include hit/miss, exclude hit/miss, and missing body.

#### 2. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Add subscription steps for account A and isolation steps for a fresh account B (local mode), plus read-only steps for remote mode.

**Contract**: `request()` also returns the response text as `body`. A unique subscription name per run (e.g. `Smoke-Sub-<timestamp>`, alphanumerics/hyphens only so HTML escaping cannot affect the match). New steps:
- Both modes: `subscriptions redirects anonymous user` (302 → `/auth/signin`, placed with the other anonymous checks); `subscriptions renders for signed-in user` (200, after sign-in).
- Local mode only, after the signed-in render: `add subscription rejects invalid amount` (302 → `/subscriptions`, error); `add subscription saves` (302 → `/subscriptions`, no error; posts `new_category=Smoke`, `currency=EUR`, `cycle=yearly`); `list shows added subscription` (200, `bodyIncludes` the name).
- Local mode only, after `dashboard redirects after signout`: `second account signs up`, `second account signs in`, `second account does not see first account's subscription` (200, `bodyExcludes` the name). B reuses the request helper; sign-out has already expired A's session cookies.
Resulting counts: local 16 steps; remote 9 (10 with `SMOKE_EXPECT_ACCESS=1`).

#### 3. Docs

**File**: `AGENTS.md`

**Intent**: Keep the smoke description accurate.

**Contract**: smoke bullet mentions it now covers adding a subscription and cross-account isolation (local) and that remote mode is read-only for subscriptions.

### Success Criteria:

#### Automated Verification:

- Matcher tests pass: `npm run test:smoke`
- Lint passes: `npm run lint`
- Local smoke passes 16/16 against `npm run preview` + local Supabase: `npm run smoke`
- Remote-mode shape against local: with a local confirmed user in `SMOKE_EMAIL`/`SMOKE_PASSWORD`, `npm run smoke` passes 9/9 and writes no subscription

#### Manual Verification:

- A deliberately broken run (temporarily make the subscriptions select policy `using (true)` in a local scratch reset, or point the B check at A's session) shows FAIL for `second account does not see first account's subscription`, then revert

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Hosted rollout and live verification

### Overview

Apply the migration to hosted Supabase, verify a new version on the protected preview and production through the runbook, and record the release.

### Changes Required:

#### 1. Hosted migration (human-only)

**File**: none (hosted Supabase)

**Intent**: Create the schema in the shared preview/production database before any preview verification.

**Contract**: human runs `npx supabase link --project-ref <ref>` (if not linked) and `npx supabase db push`; confirms in the dashboard that both tables exist with RLS enabled and 8 starter categories. The agent does not run commands against the production database.

#### 2. Release via runbook

**File**: none (Cloudflare)

**Intent**: Ship the app version through the F-01 gate.

**Contract**: runbook steps — local gates, `npm run build`, `npx wrangler versions upload`; `BASE_URL=<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` → 10/10; human manual check on the preview; human approves `npx wrangler versions deploy`; `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote` → 9/9.

#### 3. Runbook and roadmap notes

**File**: `context/plans/deployment-plan.md`, `context/foundation/roadmap.md`

**Intent**: Keep the runbook's expected step counts and migration step true, and record the currency decision.

**Contract**: runbook per-release section: local smoke 16/16, preview 10/10, production 9/9; a step "apply pending migrations (`npx supabase db push`, human) before uploading a version that needs them"; a short Pass entry recording this release (version id, results). The roadmap currency decision (Open Roadmap Question 2, S-01 unknowns, S-04 outcome/risk) was already recorded on 2026-10-02 during planning — no further roadmap edit beyond the status flips owned by `/10x-implement` and `/10x-archive`.

### Success Criteria:

#### Automated Verification:

- Preview remote smoke passes 10/10: `BASE_URL=<preview-url> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote`
- Production remote smoke passes 9/9: `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote`
- Lint passes: `npm run lint`

#### Manual Verification:

- Hosted dashboard shows `categories` (8 starter rows) and `subscriptions` with RLS enabled after `db push`
- On the preview, the owner's account adds a subscription and sees it; the smoke test account then loads `/subscriptions` and does not see it
- After promotion, production `/subscriptions` works for the owner's account and the runbook Pass entry is recorded

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `scripts/smoke-match.test.mjs`: body include/exclude/missing-body cases alongside the existing redirect cases.

### Integration Tests:

- `npm run test:rls` (local Supabase, CI): cross-account select/insert/update/delete and anon access through the REST API.
- `npm run smoke` (local Supabase, CI): add flow, invalid input rejection, and account B not seeing account A's subscription through the app.

### Manual Testing Steps:

1. Add a subscription with a comma decimal and a starter category; confirm the saved banner and top-of-list row.
2. Create a category on the spot, then reuse it with different casing.
3. Try invalid values client-side and a crafted invalid post server-side.
4. Check phone-width layout.
5. On the preview, check isolation between the owner's account and the smoke test account.

## Performance Considerations

Single-user list sizes (tens of rows); one indexed query per page load (`user_id, created_at desc`). No pagination or caching needed.

## Migration Notes

Additive only (new tables, policies, grants, starter rows); safe to apply while the previous version serves production. Rollback = redeploy the previous Worker version; the unused tables can stay. S-02/S-03 add `update`/`delete` policies in their own migrations. Regenerate `src/db/database.types.ts` with `npm run db:types` after every migration.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (US-01, FR-002, NFRs, Guardrails)
- Redirect-style route pattern: `src/pages/api/auth/signin.ts:4-20`
- Form pattern: `src/components/auth/SignInForm.tsx:12-87`
- Smoke runner and matcher: `scripts/smoke.mjs:51-104`, `scripts/smoke-match.mjs:10-25`
- Release runbook: `context/plans/deployment-plan.md:261`
- Prior change: `context/archive/2026-09-30-safe-release-verification/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, RLS and policy check

#### Automated

- [x] 1.1 Migration applies on a clean local DB: `npx supabase db reset` — fa0260b
- [x] 1.2 Generated types are current: re-running the type generation produces no diff in `src/db/database.types.ts` — fa0260b
- [x] 1.3 RLS check passes against local Supabase: `npm run test:rls` — fa0260b
- [x] 1.4 Lint passes: `npm run lint` — fa0260b
- [x] 1.5 Type check passes: `npx astro check` — fa0260b

#### Manual

- [x] 1.6 In local Studio (or `psql`), `categories` shows the 8 starter rows with `user_id` null and both tables show RLS enabled with only the listed policies — fa0260b

### Phase 2: Service, API and /subscriptions page

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 26a7d27
- [x] 2.2 Type check passes: `npx astro check` — 26a7d27
- [x] 2.3 Build passes: `npm run build` — 26a7d27
- [x] 2.4 Existing local smoke still passes 8/8 against `npm run preview` + local Supabase: `npm run smoke` — 26a7d27

#### Manual

- [x] 2.5 Signed in locally: adding "Netflix", `49,99`, PLN, monthly, Streaming shows "Subscription saved" and the row `49.99 PLN · monthly · Streaming` at the top — 26a7d27
- [x] 2.6 Choosing "+ New category…" with `Video` creates and uses it; adding another with `video` reuses the same category (appears once in the select) — 26a7d27
- [x] 2.7 Empty name, `0`, `abc`, `1.999` are blocked client-side with field errors; a crafted bad post (e.g. curl with `currency=GBP`) returns to the page with a visible error and writes nothing — 26a7d27
- [x] 2.8 Anonymous `/subscriptions` redirects to `/auth/signin`; a second local account sees an empty list — 26a7d27
- [x] 2.9 Page is usable at ~375px width (no horizontal scroll, form controls reachable) — 26a7d27
- [x] 2.10 A new category named `S%` is created as its own category and does not reuse "Streaming" — 26a7d27

### Phase 3: Smoke coverage for add and cross-account isolation

#### Automated

- [x] 3.1 Matcher tests pass: `npm run test:smoke` — 06da851
- [x] 3.2 Lint passes: `npm run lint` — 06da851
- [x] 3.3 Local smoke passes 16/16 against `npm run preview` + local Supabase: `npm run smoke` — 06da851
- [x] 3.4 Remote-mode shape against local: with a local confirmed user in `SMOKE_EMAIL`/`SMOKE_PASSWORD`, `npm run smoke` passes 9/9 and writes no subscription — 06da851

#### Manual

- [x] 3.5 A deliberately broken run (temporarily make the subscriptions select policy `using (true)` in a local scratch reset, or point the B check at A's session) shows FAIL for `second account does not see first account's subscription`, then revert — 06da851

### Phase 4: Hosted rollout and live verification

#### Automated

- [x] 4.1 Preview remote smoke passes 10/10: `BASE_URL=<preview-url> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` — 2b10769
- [x] 4.2 Production remote smoke passes 9/9: `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote` — 2b10769
- [x] 4.3 Lint passes: `npm run lint` — 2b10769

#### Manual

- [x] 4.4 Hosted dashboard shows `categories` (8 starter rows) and `subscriptions` with RLS enabled after `db push` — 2b10769
- [x] 4.5 On the preview, the owner's account adds a subscription and sees it; the smoke test account then loads `/subscriptions` and does not see it — 2b10769
- [x] 4.6 After promotion, production `/subscriptions` works for the owner's account and the runbook Pass entry is recorded — 2b10769
