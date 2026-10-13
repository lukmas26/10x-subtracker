<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Edit a Subscription

- **Plan**: context/changes/edit-subscription/plan.md
- **Scope**: Full plan (completed phases; Phase 4 hosted rollout pending)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated criteria re-run on 2026-10-12, all passing:

- `npx supabase migration up`: no pending migrations.
- `npm run db:types`: no diff.
- `npm run test:rls`: all checks passed.
- `npx astro check`: 0 errors.
- `npm run lint`: clean.
- `npm run lint:ui`: clean.
- `npm run build`: succeeded.
- `npm run smoke`: all steps passed.
- `npm run test:smoke`: 38/38 passed.

Manual checks 1.6, 2.6–2.10 and 3.4 were confirmed by the user.

Security checks with no findings:

- The update grant is column-level.
- The update policy has both `using` and `with check`, and the category must be a starter or the caller's own.
- The RPC is `security invoker`, uses `search_path = ''`, and raises P0002 when no row was updated.
- The RPC is executable by `authenticated` only.
- `params.id` passes the UUID check before any redirect uses it, so there is no open redirect.
- CSRF is covered by Astro's `checkOrigin` default.
- `?error=` is filtered through an allowlist before it is shown.

## Findings

### F1 — Not-found message renders inside the add form

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/subscriptions.astro:46 (with src/pages/api/subscriptions/[id].ts:28,39 and src/pages/subscriptions/[id]/edit.astro:17)
- **Detail**: Unknown, malformed and foreign ids redirect to `/subscriptions?error=Subscription not found.`, which matches the plan's contract. That page passes `error` only to the add form's `serverError`, so the message appears under "Add subscription" inside the "Add a subscription" card. It looks as if an add attempt had failed.
- **Fix**: On `/subscriptions`, show `notFound` as a page-level destructive `Alert` above the list card (next to the "Subscription updated" alert). Keep other errors on the add form.
- **Decision**: FIXED — `subscriptions.astro`: notFound shown as a destructive Alert inside the list card; other errors stay on the add form.

### F2 — New UI states missing from /dev/kitchen-sink

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dev/kitchen-sink.astro:98-110
- **Detail**: AGENTS.md `## UI` requires new states to be shown on `/dev/kitchen-sink`. Its "List — populated" sample still renders the old row without the Edit link, so hover and focus-visible of the link are never shown in either theme. The "Subscription updated" alert is also missing. So are the edit form's states: the prefilled form with "Save changes" and the load-error alert.
- **Fix**: Mirror the new row layout from `subscriptions.astro:66-80` in the kitchen-sink list sample, and add the updated alert and a prefilled `SubscriptionForm` with `submitLabel="Save changes"`.
- **Decision**: FIXED — kitchen-sink: new list row with Edit link, "Subscription updated" and "Subscription not found." alerts, edit-page header with Cancel; KitchenSinkFields: SubmitButton "Save changes".

### F3 — Smoke isolation steps can pass vacuously

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:117 (editPagePath fallback)
- **Detail**: When "list links to edit page" captures nothing, `editPagePath()` falls back to `/subscriptions/not-captured/edit`. The two second-account steps then hit an id that also redirects to "not found", so they PASS without testing A's subscription. The run still fails on the capture step, but the two PASS lines give false assurance.
- **Fix**: Make the two isolation steps' expectations functions that fail when `editPath` is null, e.g. `() => (editPath ? notFound : { check: () => false, describe: "edit path captured earlier" })`.
- **Decision**: FIXED — `smoke.mjs`: isolation steps use `notFoundForCaptured`, failing when no edit path was captured (break-check: both steps went red).

### F4 — ESLint workaround applies to every .astro file

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:70-72
- **Detail**: This change is not in the plan. It disables `no-misused-promises` `checksVoidReturn.returns` for all `*.astro` files because the rule crashes on a top-level `return Astro.redirect(...)`. The workaround is documented and narrow in what it disables, but not in which files it covers. An inline `eslint-disable` would not help, because the rule still runs and crashes.
- **Fix**: Scope the override to the pages that redirect from frontmatter, e.g. `files: ["src/pages/subscriptions/[[]id]/edit.astro"]`. Widen it when the next page needs it.
- **Decision**: FIXED — `eslint.config.js`: override moved to `astroRedirectPagesConfig` scoped to `src/pages/subscriptions/*/edit.astro`.

### F5 — "Subscription updated" alert placed outside any card

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/subscriptions.astro:49-53
- **Detail**: The plan placed the alert "above the list card", and that is what was implemented. The existing "Subscription saved" alert sits inside its card with `mb-4`, so the two confirmations follow different patterns on the same page.
- **Fix**: Move the updated alert inside the list card above the `<h2>` with `className="mb-4"`. If F1 is fixed, place the not-found alert the same way.
- **Decision**: FIXED — "Subscription updated" alert moved inside the list card under the heading with `mb-4`, like "Subscription saved".

## Triage summary (2026-10-13)

- Fixed: F1, F2, F3, F4, F5 (5)
