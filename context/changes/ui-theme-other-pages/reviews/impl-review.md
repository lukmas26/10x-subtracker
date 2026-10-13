<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Theme the remaining pages (auth, dashboard, landing)

- **Plan**: context/changes/ui-theme-other-pages/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

Note on scope: every phase has one open Progress item (1.9, 2.7, 3.9, 4.6, the post-change screenshots), which the plan records as deliberately skipped. All four phases were reviewed in full on that basis.

Automated verification run on 2026-10-13 at `be46682`: `npm run lint:ui`, `npm run lint`, `npx astro check` (0 errors, 0 warnings), `npm run test:smoke` (33 pass), `npm run build`, `astro preview` (`/` 200, `/dev/kitchen-sink` 404), `grep` for `dark bg-cosmic` / "Pinned dark" / `style=` / `rgba(` (none), local `npm run smoke` (all steps passed).

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Findings

### F1 — Post-change screenshot gate not met

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-theme-other-pages/plan.md:417, 432, 449, 463
- **Detail**: Checks 1.9, 2.7, 3.9 and 4.6 (per-page, kitchen-sink, focus-visible and hover screenshots) are open. The user chose live checks instead, recorded in Progress and `screenshots/README.md`. The dark baseline was also captured after implementation, from `187299d`, not before Phase 1 as planned; that too is documented. The views were verified live (1.5–1.8, 2.4–2.6, 3.5–3.8, 4.4, 4.5), so the risk is missing evidence, not missing verification.
- **Fix**: Accept as documented; capture the screenshots later only if the gate evidence is needed (e.g. for a PR reviewer).
- **Decision**: ACCEPTED — post-change screenshots deliberately skipped by the user; live checks and the committed baseline stand as evidence (no code change).

### F2 — `Button asChild` → `buttonVariants()` deviation not recorded in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/ui-theme-other-pages/plan.md:161, 239, 294
- **Detail**: The plan specifies `Button asChild` for the dashboard link, the landing CTAs and the kitchen-sink link block. The code uses `class:list={buttonVariants(...)}` on `<a>` (`dashboard.astro:20`, `Welcome.astro:37`, `kitchen-sink.astro:527-532`) because Astro wraps React children in `<astro-slot>`, which `Slot` cannot merge into. The reason is in code comments and in the `AGENTS.md` `## UI` rule, but plan.md and change.md still say `asChild`, so the plan is not an accurate record.
- **Fix**: Add a one-line deviation note to plan.md (Progress or the affected Changes Required items) pointing at the `AGENTS.md` rule.
- **Decision**: FIXED — deviation note appended to the Progress section of plan.md.

### F3 — State matrix cites screenshot files that will not exist

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-theme-other-pages/screenshots/README.md (7-state matrix)
- **Detail**: The matrix gives `kitchen-sink-*`, `hover.png` and `focus-visible-{light,dark}.png` as evidence for default, hover and focus-visible. After the decision not to capture them, those cells point at nothing.
- **Fix**: Change those cells to "checked live on the kitchen sink (plan check 4.4)".
- **Decision**: FIXED — matrix cells in screenshots/README.md now cite the live checks (4.4, 1.7, 2.6).

### F4 — Feature-card class string duplicated in the kitchen sink

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dev/kitchen-sink.astro:166
- **Detail**: `"gap-0 p-6 backdrop-blur-xl dark:shadow-none"` is copied from `Welcome.astro:56`; if the landing card changes, the kitchen-sink sample drifts silently — the problem `panelClass` solved for panels.
- **Fix**: Export `featureCardClass` from `src/lib/styles.ts` and use it in both places (or accept two uses).
- **Decision**: FIXED — `featureCardClass` exported from src/lib/styles.ts and used in Welcome.astro and kitchen-sink.astro; rendered classes unchanged.

### F5 — Decorative emoji on confirm-email is announced by screen readers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/confirm-email.astro:28
- **Detail**: `<div class="mb-4 text-5xl">{content.emoji}</div>` is decorative; pre-existing, not introduced by this change.
- **Fix**: Add `aria-hidden="true"` to the emoji `div`.
- **Decision**: FIXED differently — per the user, the emoji was removed from confirm-email (both variants) instead of hidden; recorded as accepted dark delta 25 in tokens.md.
