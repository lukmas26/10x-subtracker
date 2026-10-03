<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Subscription on List

- **Plan**: context/changes/first-subscription-on-list/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 7 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria were re-run on 2026-10-03 and all passed:

- the migration matches the committed generated types (no drift);
- `test:rls` 12/12, `test:smoke` 21/21;
- lint, `astro check` and build pass;
- local smoke 16/16 and production `smoke:remote` 9/9;
- CI on PR #10 (`ci` and `smoke`) passes.

`npx supabase db reset` was not re-run, so the user's local manual-test data survives; it passed in Phase 1. All manual items have observable evidence in the session.

Verified and dropped: the `auth.users` delete cascade with `subscriptions.category_id` NO ACTION does not block. A rolled-back delete of an `rls-*` user removed its category and subscription.

## Findings

### F1 — rls-check "must fail" inserts pass on any error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/rls-check.mjs:104
- **Detail**: The three "B cannot insert…" checks (lines 104, 110, 116) assert `Boolean(error)`. They would also pass on a NOT NULL or check-constraint error, a renamed column, or a missing `starterId` (line 91), so they do not prove that RLS denied the insert. In the starterId case the run still fails overall, because the separate categories check fails. The update/delete/anon checks rightly accept a 42501 "no grant" error.
- **Fix**: Assert `error?.code === "42501"` for the three insert checks, and guard that `starterId` is defined before using it.
- **Decision**: FIXED — the three insert checks assert `error?.code === "42501"` and a missing starter category aborts the run; a break-check (RLS-allowed row hitting a CHECK constraint) now FAILs.

### F2 — Two Supabase clients per request, with a double token refresh on expiry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/pages/subscriptions.astro:17
- **Detail**: `src/middleware.ts:7` creates a client and calls `getUser()`, and `subscriptions.astro:17` and `api/subscriptions.ts:10` each create another one from the same request cookies. When the access token has expired, the middleware refreshes it and rotates the refresh token. The second client still holds the old cookies and refreshes again with the token that was just rotated. That only works because of `refresh_token_reuse_interval = 10` (`supabase/config.toml:167`). It also doubles the auth round-trips and Set-Cookie writes. The pattern already existed (signout), but these are the first routes that query data through the second client.
- **Fix A ⭐ Recommended**: Create the client once in middleware, expose it as `context.locals.supabase` (typed in `env.d.ts`), and reuse it in the page and the route. Keep the null branch.
  - Strength: One client per request. Refresh happens once and no longer depends on the reuse interval. Removes a pattern that every future data page would copy.
  - Tradeoff: Touches middleware and `env.d.ts`, and the auth routes should migrate too for consistency. The change is a bit wider than this slice.
  - Confidence: MED — this is the standard Astro + @supabase/ssr pattern; the refresh race is reasoned from how the library works, not reproduced.
  - Blind spot: The double-refresh behaviour with an expired token on hosted Supabase was not reproduced.
- **Fix B**: Accept it for now and make the shared client a follow-up before S-02 adds more data routes.
  - Strength: Keeps this PR at its planned scope; the current behaviour works within the reuse interval.
  - Tradeoff: Every new data route copies the pattern until the follow-up lands.
  - Confidence: HIGH — the smoke and manual tests passed, including sign-in → list.
  - Blind spot: An edge-case session loss if the second refresh ever falls outside the reuse window.
- **Decision**: FIXED via Fix A — middleware stores the client in `locals.supabase` (typed in `src/env.d.ts`); `/subscriptions` and `POST /api/subscriptions` reuse it; AGENTS.md updated. Auth routes left on their own `createClient` (plan "NOT doing: any auth route") — migrate in a later change. lint, astro check, build, smoke 16/16 green.

### F3 — Category create and subscription insert are not atomic

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/subscriptions.ts:127
- **Detail**: If the subscription insert fails after a new category was created, the category stays behind as an orphan. This is harmless: the next attempt reuses it, and the plan accepted it explicitly. The 23505 race is handled.
- **Fix**: Accept. If ever needed, an atomic `security invoker` RPC can replace the two inserts.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Multi-step writes across tables are not atomic — new migration `20261003140000_create_subscription_rpc.sql` adds `public.create_subscription` (security invoker, one transaction); the service calls it via `rpc()`; `rls-check` gains 4 RPC checks (no orphan on failed save, RLS on foreign category, no anon execute). Break-check: a non-atomic variant FAILs the orphan check. Needs hosted `db push` + redeploy.

### F4 — `row.category.name` assumes the embedded category is never null

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/subscriptions.ts:169
- **Detail**: Today this holds: `category_id` is NOT NULL, categories cannot be updated or deleted, and the insert policy allows only visible categories. If S-02/S-03 make a category invisible, PostgREST returns `category: null` and the whole list throws, which the page shows as a generic load error. This is the same mechanism seen during the 3.5 broken-policy run.
- **Fix**: Use `row.category?.name ?? "—"` so one row cannot break the whole list.
- **Decision**: SKIPPED

### F5 — CI does not check generated types against the schema

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:49
- **Detail**: `src/db/database.types.ts` is regenerated by hand, and ESLint and Prettier ignore it. A later migration without `npm run db:types` would drift silently, and `astro check` would still pass against the stale types.
- **Fix**: In the smoke job, after `supabase start`, add `npx supabase gen types typescript --local | diff - src/db/database.types.ts`.
- **Decision**: FIXED — CI smoke job runs `supabase gen types typescript --local | diff - src/db/database.types.ts` after start; locally verified it passes on current types and exits 1 on a deliberate drift. (First CI run will confirm it works with the `-x postgres-meta` exclusions.)

### F6 — rls-check has no guard against a hosted URL

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/rls-check.mjs:9
- **Detail**: The rule that this script must never run against hosted Supabase lives only in AGENTS.md. The script signs up two users per run and never deletes them. Against hosted Supabase that would mean confirmation emails and leftover users in the shared production database.
- **Fix**: Exit 1 unless the `SUPABASE_URL` host is `127.0.0.1` or `localhost`.
- **Decision**: FIXED — rls-check exits 1 unless the `SUPABASE_URL` host is 127.0.0.1, localhost or [::1]; verified a hosted URL and an unparseable URL are refused, local run passes.

### F7 — `?error=` text is reflected verbatim

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/subscriptions.astro:10
- **Detail**: Any `/subscriptions?error=...` link shows arbitrary text styled as an app error. React escapes it, so this is not XSS, only content spoofing. It is the same pattern as the signin and signup pages, so it is not a regression.
- **Fix**: Optionally, across all pages, switch to error codes mapped to fixed messages.
- **Decision**: FIXED (differently, scoped) — all add-subscription messages live in `SUBSCRIPTION_ERRORS`; `/subscriptions` shows `?error=` only via `displayableError()` (known message as-is, anything else → generic "Something went wrong. Please try again."). URL contract and smoke unchanged; auth pages untouched (plan "NOT doing"). Verified: known message shown, crafted text replaced; smoke 16/16.

### F8 — Shared form primitives live under `components/auth/`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/subscriptions/SubscriptionForm.tsx:3
- **Detail**: The subscriptions form imports `FormField`, `ServerError` and `SubmitButton` from `@/components/auth/`, and `FormField` was extended for this feature. These are now shared primitives sitting in a feature folder, while `SelectField` lives in `subscriptions/`.
- **Fix**: In a follow-up, move them (and `SelectField`) to `src/components/form/`.
- **Decision**: FIXED — `FormField`, `ServerError`, `SubmitButton` and `SelectField` moved (git mv) to `src/components/form/`; SignIn/SignUp/Subscription forms re-pointed (import paths only); AGENTS.md updated. lint, astro check, build, smoke 16/16 green; auth pages render 200.

### F9 — Unrelated changes bundled into the Phase 1 commit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: fa0260b (CLAUDE.md, tsconfig.json, .gitattributes, context/plans/roadmap-github-sync.md)
- **Detail**: These were included by user choice ("Stage all"). `tsconfig.json` drops `node_modules` from `include`, a real build-config change outside the plan. The PR description lists it. Prettier also reflowed three older runbook tables (whitespace only).
- **Fix**: No code change. Keep the PR description's note so a reviewer can see the config change.
- **Decision**: SKIPPED
