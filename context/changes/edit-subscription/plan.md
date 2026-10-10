# Edit a Subscription Implementation Plan

## Overview

Roadmap S-02 (FR-003): a signed-in user opens an existing subscription on a dedicated edit page, changes any of its fields (name, amount, currency, cycle, category — picked or created on the spot), saves, and lands back on `/subscriptions` with a "Subscription updated" confirmation. The save is one atomic database call guarded by RLS, so a failed save leaves the stored row exactly as it was and a user can never edit another account's subscription.

## Current State Analysis

S-01 delivered add + list. The schema, RLS and app code allow only `select` and `insert` on `subscriptions`; there is no way to change a row.

- `supabase/migrations/20261003120000_subscriptions_and_categories.sql:43-48` — grants and policies cover `select, insert` only; the comment explicitly defers update/delete to S-02/S-03.
- `supabase/migrations/20261003140000_create_subscription_rpc.sql` — `create_subscription` resolves or creates the category and inserts the subscription in one `security invoker` function (one transaction), per the atomic-writes rule in `context/foundation/lessons.md`.
- `src/lib/services/subscriptions.ts:66-103` — `parseNewSubscription` validates the form (same fields an edit needs); `:117-140` `createSubscription` calls the RPC and maps errors to `SUBSCRIPTION_ERRORS`; `:50-54` `displayableError` whitelists `?error=` messages.
- `src/pages/api/subscriptions.ts` — thin POST route: parse → service → redirect with `?saved=1` or `?error=`.
- `src/components/subscriptions/SubscriptionForm.tsx:31-38,87,189` — hard-wired empty initial state, `action="/api/subscriptions"`, label "Add subscription".
- `src/pages/subscriptions.astro:56-65` — list items show name and `amount currency · cycle · category`, no actions.
- `src/middleware.ts:4,19` — `startsWith("/subscriptions")` already protects any `/subscriptions/...` page; API routes check `locals.user` themselves.
- `scripts/rls-check.mjs` — REST-level two-account policy check run in CI; `scripts/smoke.mjs` — local add + isolation steps, remote mode read-only; `scripts/smoke-match.mjs` — status/redirect/body matcher, no way to capture values from a response.

## Desired End State

Each list item on `/subscriptions` has an "Edit" link to `/subscriptions/<id>/edit`. That page shows the shared form prefilled with the stored values (category preselected). Submitting a valid change redirects to `/subscriptions?updated=1`, which shows "Subscription updated" and the entry with its new values in its unchanged position (list order stays newest-created first). A server-side rejection redirects back to the edit page with a whitelisted `?error=` and the form showing the stored, unchanged values. An unknown, malformed or another account's id — on the page or the route — redirects to `/subscriptions?error=Subscription not found.` with no way to tell the cases apart.

Verified by: `npm run test:rls` (new update cases), `npm run smoke` (new edit steps), `npm run test:smoke` (new helper), lint/type checks, and a manual check on desktop and phone width; then the hosted rollout through the release runbook.

### Key Discoveries:

- Column-level `grant update (name, amount, currency, cycle, category_id)` makes `user_id` and `created_at` immutable at the privilege level, independent of policy wording.
- The update policy needs both clauses: `using (user_id = auth.uid())` hides other rows from the `UPDATE`; `with check` repeats ownership and adds the visible-category check from `subscriptions_insert_own_with_visible_category` (`20261003120000_...sql:72-84`), otherwise a user could point their row at another user's private category id.
- Under RLS, an `UPDATE` targeting someone else's row matches 0 rows and succeeds silently — the RPC must detect "no row updated" itself and raise, or the route would report success.
- `create_subscription`'s category block cannot be shared through a helper function without granting `execute` on it to `authenticated` (it would then be exposed through PostgREST); duplicating the block with a cross-reference comment is the smaller surface.
- `smoke.mjs` step expectations are evaluated at module load, so steps that target the captured subscription id need lazily resolved expectations.

## What We're NOT Doing

- Concurrent-edit detection: last write wins. Two tabs saving the same subscription silently keep the later save; no `updated_at` column or version check.
- Preserving typed input after a server-side rejection: the edit page reloads the stored values (client validation mirrors the server, so this only happens on real save failures).
- Inline or modal editing on the list.
- Highlighting the edited row after save.
- Deleting subscriptions (S-03), totals (S-04), category rename/delete, or cleaning up a category left unused after an edit.
- Edit steps in `smoke:remote` — it stays read-only for subscriptions.
- Changes to auth routes or `/dashboard`.

## Implementation Approach

Follow S-01's shape exactly: Postgres RLS is the security boundary, one `security invoker` RPC per write, a thin API route, the service owns validation and error mapping, the Astro page server-renders and hosts the React form island, native POST → redirect. Build bottom-up so each phase is verifiable alone: schema + REST-level policy proof, then the app path, then smoke, then the hosted release.

## Critical Implementation Details

**Rollout ordering.** The migration must reach hosted Supabase (`npx supabase db push`) before a version that calls `update_subscription` is uploaded. It is additive, so the live version keeps working in between.

**Parallel work with `ui-theme-other-pages`.** That change may run at the same time in another agent. Local Supabase is one shared Docker instance: apply the migration with `npx supabase migration up`, never `db reset`, which would wipe the other agent's users and break its smoke and screenshots. Run the dev server on its own port (e.g. `npm run dev -- --port 4322` with `BASE_URL=http://localhost:4322`) after the `AGENTS.md` port check, and work in a separate worktree. Releases go one at a time, each built from current `master` after merge, never from a feature branch, so neither release promotes a version without the other's merged work.

## Phase 1: Schema, RLS and policy check

### Overview

Allow a user to update only their own subscriptions, atomically, through one RPC, and prove the policies at the REST level.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261010120000_update_subscription.sql`

**Intent**: Grant the minimum privileges for editing, add the update policy, and add the atomic `update_subscription` RPC so changing fields and creating a category on the spot succeed or fail together.

**Contract**:

- `grant update (name, amount, currency, cycle, category_id) on public.subscriptions to authenticated` — column-level, no `user_id`/`created_at`.
- Policy `subscriptions_update_own_with_visible_category`: `for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (<category visible: starter or own>))`.
- `public.update_subscription(p_id uuid, p_name text, p_amount numeric, p_currency text, p_cycle text, p_category_id uuid default null, p_new_category text default null) returns uuid`, `language plpgsql security invoker set search_path = ''`. Not authenticated → `42501`. Category resolution identical to `create_subscription` (copied, with a comment pointing at it). `update public.subscriptions set ... where id = p_id returning id`; when no row is returned, `raise exception 'subscription not found' using errcode = 'P0002'` (this also rolls back a category created in the same call).
- `revoke all ... from public, anon; grant execute ... to authenticated` on the exact signature.

#### 2. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate so the typed client knows `update_subscription`.

**Contract**: Output of `npm run db:types`; never hand-edited.

#### 3. Policy check

**File**: `scripts/rls-check.mjs`

**Intent**: Prove the update boundary through the Supabase REST API with the two throwaway users, the same way S-01's insert/select boundary is proven.

**Contract**: New `check(...)` cases:

- A updates own subscription via RPC (new name/amount/currency/cycle) and reads the new values back.
- B's RPC update of A's subscription id fails with `P0002`; A's row is unchanged.
- B's direct `PATCH` on A's subscription affects 0 rows; A's row is unchanged.
- A cannot change `user_id` of own subscription (direct `PATCH` fails on column privilege).
- A cannot move own subscription into B's private category (RPC and direct `PATCH` both rejected).
- A's failed RPC update (amount 0) with a brand-new category name leaves the row unchanged and creates no category.
- anon cannot call `update_subscription`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local Supabase without wiping it: `npx supabase migration up`
- Generated types are current: `npm run db:types` leaves no diff after the commit
- Policy check passes, including the new update cases: `npm run test:rls`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Migration reviewed: grant is column-level, policy has both `using` and `with check`, RPC raises when no row is updated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service, API route and edit page

### Overview

The user-facing edit flow: Edit link on the list, prefilled edit page, save route, confirmation.

### Changes Required:

#### 1. Types

**File**: `src/types.ts`

**Intent**: A DTO for prefilling the edit form.

**Contract**: `SubscriptionEditDTO { id; name; amount (exact decimal string); currency: Currency; cycle: Cycle; categoryId: string }`.

#### 2. Service

**File**: `src/lib/services/subscriptions.ts`

**Intent**: Read one subscription for the edit page and save an edit through the RPC, reusing the existing form parser and error vocabulary.

**Contract**:

- `SUBSCRIPTION_ERRORS.notFound = "Subscription not found."` (whitelisted by `displayableError` automatically).
- Export an `isSubscriptionId(value: string): boolean` built on the existing `UUID_PATTERN`.
- `getSubscription(supabase, id): Promise<SubscriptionEditDTO | null>` — RLS-scoped `select` with `amount::text`; `null` when no row; logs and throws on a DB error like `listSubscriptions`.
- `updateSubscription(supabase, id, input: NewSubscriptionInput): Promise<{ ok: true } | { ok: false; error: string }>` — calls `update_subscription` with the same parameter mapping as `createSubscription`; error code `P0002` → `notFound`, any other error → logged, `save`.
- `parseNewSubscription` is reused unchanged for edit input.

#### 3. API route

**File**: `src/pages/api/subscriptions/[id].ts`

**Intent**: Save an edit with the same thin shape as `src/pages/api/subscriptions.ts`.

**Contract**: `POST` only. No client → `/subscriptions?error=<notConfigured>`; no user → `/auth/signin`; malformed id → `/subscriptions?error=<notFound>`; parse error or save error → `/subscriptions/<id>/edit?error=<message>`; `notFound` from the service → `/subscriptions?error=<notFound>`; success → `/subscriptions?updated=1`.

#### 4. Edit page

**File**: `src/pages/subscriptions/[id]/edit.astro`

**Intent**: Prefilled edit form inside the same layout and card styling as `/subscriptions`.

**Contract**: Malformed id or `getSubscription` → `null` → redirect `/subscriptions?error=<notFound>`. Loads subscription and categories in parallel; load failure shows a destructive `Alert` like the list page. Heading "Edit subscription", `?error=` shown through `displayableError` → `ServerError`, a "Cancel" link back to `/subscriptions`. Tokens and `src/components/ui` only. The card uses the shared `panelClass` from `src/lib/styles.ts` when `ui-theme-other-pages` has already added it; otherwise a local copy of the `/subscriptions` class string, which whichever change merges second replaces with `panelClass`.

#### 5. Form island

**File**: `src/components/subscriptions/SubscriptionForm.tsx`

**Intent**: Make the form serve both add and edit without forking it.

**Contract**: New optional props `initial?: { name; amount; currency; cycle; categoryId }`, `action` (default `/api/subscriptions`), `submitLabel` (default "Add subscription"), `pendingText` (default "Saving..."). Initial state comes from `initial` when given; validation and field markup unchanged. The add page keeps its current behaviour with no prop changes.

#### 6. List page

**File**: `src/pages/subscriptions.astro`

**Intent**: Entry point to editing and the post-save confirmation.

**Contract**: Each `<li>` gets an Edit link (`Button asChild`, existing variant/size, `href="/subscriptions/<id>/edit"`, `aria-label="Edit <name>"`), laid out so it does not squeeze the text on phone width. `?updated=1` shows a `success` `Alert` "Subscription updated" with `role="status"`, placed above the list card.

#### 7. UI literal scope

**File**: `scripts/ui-literals-check.mjs`

**Intent**: Keep the new view on tokens.

**Contract**: Add `src/pages/subscriptions/[id]/edit.astro` to `SCOPE`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- UI literal check passes with the new page in scope: `npm run lint:ui`
- Build succeeds: `npm run build`
- Existing smoke still passes: `npm run smoke`

#### Manual Verification:

- Edit link opens the edit page with every field prefilled and the stored category selected
- Changing fields (incl. currency and a new category on the spot) saves and shows "Subscription updated" with the new values in the same list position
- Invalid input is caught client-side; a server-side rejection lands on the edit page with the error and the stored values
- An unknown or another account's id redirects to the list with "Subscription not found."
- Layout, Edit link focus-visible state and both themes look right on desktop and phone width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Smoke coverage

### Overview

Drive the edit flow and its cross-account boundary through the real app in local smoke and CI.

### Changes Required:

#### 1. Edit-link helper

**File**: `scripts/smoke-match.mjs`, `scripts/smoke-match.test.mjs`

**Intent**: Capture the subscription id from the rendered list so later steps can target it.

**Contract**: `extractEditPath(body: string): string | null` — first `href="/subscriptions/<uuid>/edit"` path in the body, else `null`. Tests: match, no match, ignores non-uuid ids.

#### 2. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Prove edit works and is isolated, local mode only.

**Contract**:

- Runner accepts an `expected` that is a function and resolves it at run time (for paths containing the captured id).
- After "list shows added subscription": "list links to edit page" (captures the path; a missing link fails the step), "edit page renders prefilled" (200, body includes the subscription name), "edit rejects invalid amount" (302 to `/subscriptions/<id>/edit` with error), "edit saves" (name `Smoke-Edit-<runId>`, amount `59.99`, currency `USD`; 302 to `/subscriptions`), "list shows edited subscription" (200, includes `Smoke-Edit-<runId>` and `59.99 USD`, excludes `Smoke-Sub-<runId>`).
- Second-account steps: "second account cannot open first account's edit page" and "second account cannot save first account's subscription" (both 302 to `/subscriptions` with error); the existing isolation step also excludes the edited name.
- Remote mode unchanged.

### Success Criteria:

#### Automated Verification:

- Matcher unit tests pass: `npm run test:smoke`
- Local smoke passes with the new edit and isolation steps: `npm run smoke`
- Lint passes: `npm run lint`

#### Manual Verification:

- Smoke output lists every new step as PASS and a deliberately broken expectation fails as expected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Hosted rollout and live verification

### Overview

Ship the migration and the app version to production through the release runbook, and record the guidance.

### Changes Required:

#### 1. Hosted migration and release

**File**: `context/plans/deployment-plan.md`

**Intent**: Release in the order the runbook requires and record it.

**Contract**: Human `npx supabase db push` → build → `wrangler versions upload` → `smoke:remote` on the protected preview → manual edit check on the preview with a real account → approval → `wrangler versions deploy` → `smoke:remote` on production. New `### Pass N` entry in `## Execution record`, numbered after the last Pass on `master` at release time.

#### 2. Agent guidance

**File**: `AGENTS.md`

**Intent**: Keep the guidance accurate.

**Contract**: The `test:rls` description covers updates; the smoke description mentions editing.

### Success Criteria:

#### Automated Verification:

- Remote smoke passes on the protected preview: `BASE_URL=https://<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote`
- Remote smoke passes on production after promotion: `BASE_URL=https://<production> npm run smoke:remote`

#### Manual Verification:

- `npx supabase db push` applied the migration on hosted before the version upload
- A real subscription edited on the preview shows the new values and the confirmation
- Next Pass recorded in `context/plans/deployment-plan.md` and AGENTS.md updated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `extractEditPath`: match, no match, non-uuid id ignored.

### Integration Tests:

- `test:rls`: own update succeeds; foreign update via RPC and direct PATCH has no effect; `user_id` immutable; foreign private category rejected; failed update is all-or-nothing (no row change, no category); anon denied.
- `smoke`: edit page prefilled; invalid edit rejected to the edit page; valid edit saved and listed (old name gone); second account can neither open nor save the first account's edit.

### Manual Testing Steps:

1. Add a subscription, click Edit, check every field is prefilled.
2. Change name, amount, currency and cycle; save; check the confirmation and the new values in the same position.
3. Edit again choosing "+ New category…"; check the new category appears in the list item and the select.
4. Open `/subscriptions/<random-uuid>/edit` and `/subscriptions/abc/edit`; both land on the list with "Subscription not found."
5. Repeat 1–2 on phone width and in both themes; tab through to check focus-visible on the Edit link and form.

## Performance Considerations

None: one RLS-scoped row read plus one RPC per edit, on the existing `subscriptions` primary key.

## Migration Notes

Additive: a column-level grant, one policy and one function. No data changes. Must be applied to hosted before the version that calls `update_subscription` (see Critical Implementation Details). Rollback of the app version leaves the unused function and policy harmless.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-02)
- Prior slice: `context/archive/2026-10-02-first-subscription-on-list/plan.md`
- Atomic-write rule: `context/foundation/lessons.md`
- Pattern for the RPC: `supabase/migrations/20261003140000_create_subscription_rpc.sql`
- Pattern for the insert policy: `supabase/migrations/20261003120000_subscriptions_and_categories.sql:72-84`
- Pattern for the route: `src/pages/api/subscriptions.ts`
- Release runbook: `context/plans/deployment-plan.md` (`## Release runbook`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, RLS and policy check

#### Automated

- [ ] 1.1 Migration applies cleanly on local Supabase without wiping it: `npx supabase migration up`
- [ ] 1.2 Generated types are current: `npm run db:types` leaves no diff after the commit
- [ ] 1.3 Policy check passes, including the new update cases: `npm run test:rls`
- [ ] 1.4 Type check passes: `npx astro check`
- [ ] 1.5 Lint passes: `npm run lint`

#### Manual

- [ ] 1.6 Migration reviewed: grant is column-level, policy has both `using` and `with check`, RPC raises when no row is updated

### Phase 2: Service, API route and edit page

#### Automated

- [ ] 2.1 Type check passes: `npx astro check`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 UI literal check passes with the new page in scope: `npm run lint:ui`
- [ ] 2.4 Build succeeds: `npm run build`
- [ ] 2.5 Existing smoke still passes: `npm run smoke`

#### Manual

- [ ] 2.6 Edit link opens the edit page with every field prefilled and the stored category selected
- [ ] 2.7 Changing fields (incl. currency and a new category on the spot) saves and shows "Subscription updated" with the new values in the same list position
- [ ] 2.8 Invalid input is caught client-side; a server-side rejection lands on the edit page with the error and the stored values
- [ ] 2.9 An unknown or another account's id redirects to the list with "Subscription not found."
- [ ] 2.10 Layout, Edit link focus-visible state and both themes look right on desktop and phone width

### Phase 3: Smoke coverage

#### Automated

- [ ] 3.1 Matcher unit tests pass: `npm run test:smoke`
- [ ] 3.2 Local smoke passes with the new edit and isolation steps: `npm run smoke`
- [ ] 3.3 Lint passes: `npm run lint`

#### Manual

- [ ] 3.4 Smoke output lists every new step as PASS and a deliberately broken expectation fails as expected

### Phase 4: Hosted rollout and live verification

#### Automated

- [ ] 4.1 Remote smoke passes on the protected preview: `BASE_URL=https://<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote`
- [ ] 4.2 Remote smoke passes on production after promotion: `BASE_URL=https://<production> npm run smoke:remote`

#### Manual

- [ ] 4.3 `npx supabase db push` applied the migration on hosted before the version upload
- [ ] 4.4 A real subscription edited on the preview shows the new values and the confirmation
- [ ] 4.5 Next Pass recorded in `context/plans/deployment-plan.md` and AGENTS.md updated
