<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First Subscription on List Implementation Plan

- **Plan**: context/changes/first-subscription-on-list/plan.md
- **Mode**: Deep (codebase verification done inline, no sub-agent)
- **Date**: 2026-10-02
- **Verdict**: REVISE → SOUND after triage (all findings fixed in plan)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

9/9 paths ✓, 6/6 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (26/26 rows at review time, one `## Progress`, no stray checkboxes)

## Findings

### F1 — Generated types file will fail lint and drift on commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — §2 Generated database types; Progress 1.2, 1.4
- **Detail**: `eslint.config.js` lints all `.ts` with `stylisticTypeChecked` (`consistent-type-definitions` rejects generated object type aliases) and `eslint-plugin-prettier` (line 88); the file is not ignored, so lint fails, and lint-staged `eslint --fix` would reformat it so "regenerate → no diff" never holds.
- **Fix**: Ignore `src/db/database.types.ts` in ESLint and `.prettierignore`; add a single `npm run db:types` script referenced by 1.2 and AGENTS.md.
- **Decision**: FIXED

### F2 — ON DELETE RESTRICT on category_id can block account deletion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — §1 Migration (`subscriptions.category_id`)
- **Detail**: Deleting an `auth.users` row cascades to categories and subscriptions; `RESTRICT` is checked immediately and can abort the cascade if a user-owned category is removed before its subscriptions.
- **Fix**: Use the default `NO ACTION` (checked at end of statement).
- **Decision**: FIXED

### F3 — Case-insensitive category reuse mechanism is unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — §1 `createSubscription`
- **Detail**: The obvious `.ilike("name", input)` treats `%`/`_` as wildcards, so `S%` would reuse "Streaming"; trimming before matching was undecided.
- **Fix**: Exact trimmed, lowercased comparison against loaded visible categories; new manual check 2.10 for `S%`.
- **Decision**: FIXED

### F4 — Generic save error hides the cause in production

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — §1 `createSubscription` error mapping
- **Detail**: Database errors map to a generic message with no server-side record; Worker logs / `wrangler tail` are the only observability.
- **Fix**: `console.error` the Supabase error `code` and `message` (never form values) before mapping.
- **Decision**: FIXED
