# First Subscription on List — Plan Brief

> Full plan: `context/changes/first-subscription-on-list/plan.md`

## What & Why

Roadmap S-01, the north star: a signed-in user adds a subscription (name, amount, currency, monthly/yearly cycle, category) and immediately sees it on their own list. It is the PRD's primary success criterion — and the first table holding financial data, so cross-account isolation (the most expensive possible bug) must be proven, not assumed.

## Starting Point

Auth works (email + password, cookie session, `/dashboard` protected) and F-01 made releases verifiable behind Cloudflare Access. There is no schema, no domain code, no `src/lib/services/` or `src/types.ts`; preview and production share one hosted database.

## Desired End State

On a new protected `/subscriptions` page a user submits the form and lands back with "Subscription saved" and the entry at the top of their list (e.g. `49.99 PLN · monthly · Streaming`). A second account sees none of it — neither in the app nor through the Supabase REST API — and CI proves this on every run. The release is verified on the protected preview and production.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Currency | Per subscription, limited to PLN / EUR / USD (default PLN) | Records the real charged amount while keeping a small known set; S-04 totals per currency, no conversion | Plan (overrides roadmap default) |
| Categories | `categories` table: ownerless starter rows from the migration + user-owned rows, unique per owner case-insensitively | Stable identity for S-05 grouping, no typo duplicates, a home for the parked FR-005 catalog | Plan |
| Page | New protected `/subscriptions`; `/dashboard` and post-sign-in redirect unchanged | Clear domain URL without touching the auth contract | Plan |
| Save flow | Native form POST → `POST /api/subscriptions` → redirect with `?saved=1` / `?error=` | Same pattern as auth routes, works without JS, smoke can drive it | Plan |
| Isolation proof | `npm run test:rls` (REST API, two users) + two-account steps in local/CI smoke; remote smoke read-only | Checks policies and the app path every CI run, writes nothing to production | Plan |
| RLS scope | `subscriptions` select + insert only; insert also checks the category is starter or own | Least privilege until S-02/S-03; blocks attaching to another user's category | Plan |
| Amount | `numeric(10,2)` > 0, comma or dot accepted, kept as a decimal string in DTOs | No float rounding on money | Plan |
| List order | Newest first | The just-saved entry is visible at the top as confirmation | Plan |

## Scope

**In scope:**
- Migration (tables, starter categories, grants, RLS), generated DB types, typed client, `src/types.ts`
- `scripts/rls-check.mjs` + `npm run test:rls` in CI
- Service, `POST /api/subscriptions`, `/subscriptions` page, `SubscriptionForm` island, Topbar link, middleware entry
- Smoke matcher body checks + add/isolation steps; AGENTS.md, runbook and roadmap notes
- Hosted migration and release through the runbook

**Out of scope:**
- Edit/delete (S-02/S-03), totals (S-04), currency conversion, other currencies
- Admin role, shared catalog, category rename/delete, auto-categorisation
- Changes to `/dashboard` or auth routes; writes in `smoke:remote`; `test:rls` against hosted

## Architecture / Approach

Postgres RLS is the security boundary: every query runs as the signed-in user through the existing cookie-session Supabase client, now typed with generated `Database` types. `src/lib/services/subscriptions.ts` owns validation, category reuse/creation and listing; the API route and Astro page stay thin. The page server-renders the list and hosts a React form island that validates with the same rules and submits natively.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, RLS and policy check | Migration, typed client, DTOs, `test:rls` in CI | A policy gap (e.g. foreign category id) — caught by the REST-level check |
| 2. Service, API and /subscriptions page | Working add + list flow, protected and mobile-usable | Client/server validation drift — shared constants |
| 3. Smoke coverage | Local 16 steps incl. add + account-B isolation; remote 9/10 read-only | Body check false-passing on escaped HTML — unique alphanumeric name |
| 4. Hosted rollout and live verification | Migration on hosted, preview 10/10, production 9/9, runbook updated | Verifying the preview before `db push` — runbook orders it first |

**Prerequisites:** local Supabase (Docker) running; human access to `supabase db push` on the hosted project and to `wrangler versions deploy`; `.env.smoke` from F-01.
**Estimated effort:** ~3 sessions across 4 phases; Phase 4 is mostly human release steps.

## Open Risks & Assumptions

- Assumes the migration is purely additive, so the promoted version keeps working between `db push` and promotion.
- Production isolation is checked manually once on the preview (remote smoke is read-only); CI covers it automatically only against local Supabase.
- A failed subscription insert after an on-the-spot category insert leaves an unused category — harmless and reusable, not data loss.
- Per-subscription currency moves complexity into S-04 (per-currency totals); recorded in the roadmap.

## Success Criteria (Summary)

- A signed-in user adds a subscription and sees it at the top of their list with a save confirmation, on desktop and phone.
- A second account never sees or writes another account's subscriptions — proven by `test:rls` and the smoke test in CI.
- The release passes the remote smoke on the protected preview and on production.
