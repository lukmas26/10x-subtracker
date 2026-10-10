# Edit a Subscription — Plan Brief

> Full plan: `context/changes/edit-subscription/plan.md`

## What & Why

Roadmap S-02 (FR-003): a user corrects an existing subscription instead of deleting and re-adding it, which would lose the entry's continuity. The PRD requires that a failed save never wipes existing data and that the user sees a confirmation almost immediately.

## Starting Point

S-01 shipped add + list on `/subscriptions`. The database allows only `select` and `insert` on subscriptions. Adding goes through the atomic `create_subscription` RPC, a thin POST route and a React form island with an empty initial state.

## Desired End State

Each list item has an "Edit" link to `/subscriptions/<id>/edit`, which opens a prefilled form. Saving returns to the list with "Subscription updated", and the entry keeps its position with the new values (e.g. `59.99 USD · yearly · Streaming`). A rejected save returns to the edit page showing the stored values unchanged. Another account's or an unknown id gives "Subscription not found.", and CI proves that no account can change another's rows.

## Key Decisions Made

| Decision         | Choice                                                                                                                 | Why (1 sentence)                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Edit UI          | Dedicated page `/subscriptions/[id]/edit`                                                                              | Reuses the form and native POST→redirect flow, works without JS, drivable by smoke                                                         |
| Editable fields  | All: name, amount, currency, cycle, category (picked or created on the spot)                                           | A wrong currency is fixable without delete+re-add; one form, one validator (goes beyond the roadmap's field list, which predates currency) |
| Failed save      | Redirect to the edit page with `?error=`, form reloads stored values                                                   | Same convention as every route, no financial data in URLs; client validation mirrors the server                                            |
| Concurrent edits | Last write wins                                                                                                        | Single-owner data, so self-conflicts are rare; no version column                                                                           |
| After save       | `/subscriptions?updated=1` + success alert, order unchanged                                                            | Confirmation where the effect is visible; mirrors `?saved=1`                                                                               |
| Atomicity        | One `security invoker` RPC `update_subscription` (category resolve/create + update)                                    | `lessons.md`: writes in one API call are all-or-nothing                                                                                    |
| Privileges       | Column-level `grant update` (no `user_id`/`created_at`) + policy `using` owner / `with check` owner + visible category | Owner can't be changed and a row can't point at another user's private category                                                            |
| Not found        | Unknown, malformed and foreign ids all → `/subscriptions?error=Subscription not found.`                                | Doesn't reveal whether someone else's id exists                                                                                            |

## Scope

**In scope:**

- Migration (grant, policy, RPC), regenerated types, new `test:rls` update cases
- `getSubscription` / `updateSubscription`, `POST /api/subscriptions/[id]`, edit page, parametrised `SubscriptionForm`, Edit link + confirmation on the list, `lint:ui` scope
- Smoke edit + cross-account steps (local), `extractEditPath` helper with tests
- Hosted rollout (next runbook Pass) and AGENTS.md notes

**Out of scope:**

- Concurrent-edit detection, preserving typed input on server rejection, inline/modal editing, row highlight
- Delete (S-03), totals (S-04), category rename/delete/cleanup
- Writes in `smoke:remote`; auth routes and `/dashboard`

## Architecture / Approach

Postgres RLS is the boundary: the edit page reads the row as the signed-in user, and the route calls `update_subscription`. That RPC runs as the caller, resolves or creates the category, updates the row, and raises `P0002` when nothing matched (another user's row or a missing one), rolling back everything. The service maps `P0002` to "not found" and other errors to the generic save message. The route and page stay thin, and the form island is shared between add and edit.

## Phases at a Glance

| Phase                           | What it delivers                                                      | Key risk                                                                                 |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Schema, RLS and policy check | Grant, policy, RPC, types, `test:rls` update cases                    | A silent 0-row update reported as success — RPC raises, checks assert it                 |
| 2. Service, route and edit page | Working edit flow with confirmation, both themes, phone width         | Breaking the add form while parametrising it — defaults keep add unchanged, smoke re-run |
| 3. Smoke coverage               | Edit + isolation steps in local smoke and CI                          | Steps depending on a captured id — lazily resolved expectations, tested helper           |
| 4. Hosted rollout               | Migration on hosted, preview + production verified, next runbook Pass | Uploading before `db push` — runbook order                                               |

**Prerequisites:** local Supabase (Docker) running; human access to `supabase db push` on hosted and to `wrangler versions deploy`; `.env.smoke`.
**Estimated effort:** ~2–3 sessions across 4 phases; Phase 4 is mostly human release steps.

## Open Risks & Assumptions

- Last write wins: two tabs saving the same subscription silently keep the later save (accepted).
- Category resolution is duplicated from `create_subscription`; a future change to one must update the other (comment cross-reference).
- Preview and production share one hosted database, so the manual preview edit check writes real data.
- A category left unused after an edit stays (harmless, reusable).

## Success Criteria (Summary)

- A user edits any field of their subscription and sees "Subscription updated" with the new values, on desktop and phone.
- A failed save leaves the stored subscription exactly as it was.
- No account can view or change another account's subscription, as proven by `test:rls` and smoke in CI.
