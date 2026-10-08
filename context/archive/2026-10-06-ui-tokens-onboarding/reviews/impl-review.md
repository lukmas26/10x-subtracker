<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: UI tokens onboarding (`/subscriptions`)

- **Plan**: context/changes/ui-tokens-onboarding/plan.md
- **Scope**: Full plan (completed phases only; Phase 5 excluded because 5.5 is open, its files covered by the safety scan only)
- **Reviewed phases**: 1, 2, 3, 4, 6
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 8 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Automated criteria re-run on 2026-10-07: `astro check`, `lint`, `lint:ui`, `test:smoke` (30/30), `build`, no `"use client"`, `ui/` contents and no hex outside `:root`/`.dark` all PASS. `npm run smoke` failed 3 steps on its first run and passed 16/16 on three later runs (F4).

## Findings

### F1 — Theme toggle's accessible name doesn't say what "pressed" means

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ThemeToggle.tsx:18
- **Detail**: `aria-label="Toggle theme"` with `aria-pressed={isDark}` is announced as "Toggle theme, toggle button, pressed", which doesn't tell the user that pressed means dark. The plan specified this exact pair, so this is a plan flaw rather than drift.
- **Fix**: Change the label to `aria-label="Dark theme"` and keep `aria-pressed={isDark}`, so "Dark theme, pressed" is self-explanatory. Mention the label in AGENTS.md if it is referenced there.
- **Decision**: FIXED — `aria-label="Dark theme"` in ThemeToggle.tsx (AGENTS.md does not reference the label)

### F2 — `lint:ui` misses some colour utilities and arbitrary units

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/ui-literals-check.mjs:31
- **Detail**: The regex is character-for-character the `/10x-ui` scan, as the plan required. That scan does not catch `decoration-*`, `accent-*`, `caret-*`, `placeholder-*`, `ring-offset-*` palette classes, arbitrary values in `em`/`vh`/`vw`/`%`, or negative arbitrary values (`top-[-12px]`). A literal of those kinds can enter a scoped file and pass both CI and the pre-commit hook. The current scope contains none.
- **Fix A ⭐ Recommended**: Extend the matcher's prefixes and units, and add a test for each
  - Strength: The check then enforces what AGENTS.md promises ("no palette classes … no arbitrary sizes"). It is a small edit to one regex plus tests in the existing pattern.
  - Tradeoff: The guard and the `/10x-ui` scan diverge; record the difference in a comment.
  - Confidence: HIGH — the reviewer fed these strings to `findLiterals` and confirmed they are missed.
  - Blind spot: A wider unit set may flag legitimate layout values in future views (`w-[50%]`), which would then need a token or a standard utility.
- **Fix B**: Keep the regex identical to `/10x-ui` and note the known gaps in the script header and AGENTS.md
  - Strength: One definition of "literal" across the skill and the guard.
  - Tradeoff: The gaps stay open; they depend on reviewers noticing.
  - Confidence: MED — depends on how often those utilities appear.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — regex widened (prefixes `ring-offset|decoration|accent|caret|placeholder`, units `em|vh|vw|%`, optional leading `-`), divergence noted in the script header, 3 tests added (33/33 pass, `lint:ui` clean)

### F3 — Plan check 5.5 (screenshots) still open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-tokens-onboarding/screenshots/README.md
- **Detail**: No PNGs were saved, because Claude in Chrome was not available and the user chose to defer them. The 7-state matrix and contrast check were confirmed manually. `/10x-archive` will flag 5.5.
- **Fix**: Capture the 9 PNGs when a browser tool is available, then tick 5.5.
- **Decision**: SKIPPED — 5.5 stays open

### F4 — `npm run smoke` failed 3 steps once, then passed three times

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (local dev server on :4321)
- **Detail**: The first smoke run during this review, made straight after `npm run build`, failed 3 steps; the failing step names were not captured. Three later runs passed 16/16. Earlier in the change, a stale Vite dependency cache produced 500s on `/subscriptions`. The likely cause is a dev-server reload, but that is not confirmed.
- **Fix**: If it recurs, capture the failing step names and the dev-server log; CI runs smoke against the production preview, which is not affected.
- **Decision**: FIXED (differently) — root cause, per the user: another dev server instance was running in a separate terminal. AGENTS.md `## Commands` now requires checking for a listener on :4321/:8787 and asking the user before starting a server or running smoke/RLS/browser flows.

### F5 — Three Phase 2 dark side effects were never explicitly accepted

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-tokens-onboarding/tokens.md:72
- **Detail**: tokens.md lists these as "not in the accepted-deltas list": the `Button` focus ring is purple-400/50 instead of grey; `body` outside the `bg-cosmic` wrapper is `#0a0e1a`; the ThemeToggle outline border is white/20 instead of white/15. The plan counts any unlisted dark change as drift. They were reported at Phase 2 and the user passed the manual check, but they were not added to the accepted list.
- **Fix**: If accepted, move them into the "Accepted visual deltas" list as items 14–16.
- **Decision**: FIXED — added to tokens.md "Accepted visual deltas" as items 14–16

### F6 — Toggle has no visible effect on the 5 pinned pages

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/layouts/Layout.astro:44
- **Detail**: On `/`, `/dashboard` and the 3 auth pages, the toggle changes only its own icon and the config banner, so users may read it as broken. The plan accepted this explicitly ("What We're NOT Doing") until `ui-theme-other-pages`.
- **Fix**: Leave as planned and make sure `ui-theme-other-pages` covers it, or add a `themeToggle={false}` Layout prop for the pinned pages.
- **Decision**: FIXED — left as planned; noted in `context/changes/ui-theme-other-pages/change.md`

### F7 — Fixed toggle can cover the end of the page on phones

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/layouts/Layout.astro:44
- **Detail**: The `fixed right-4 bottom-4` button sits inside the page's `p-4` padding, so at the bottom of the scroll on a 375 px screen it can overlap the right edge of the last card or list row. The manual 375 px check passed.
- **Fix**: Add bottom padding to the `/subscriptions` wrapper (e.g. `pb-20`) if it bothers anyone.
- **Decision**: FIXED — `/subscriptions` wrapper now `p-4 pb-20 sm:p-8 sm:pb-20`

### F8 — Hex pattern will hit non-colour `#` strings in future scope

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/ui-literals-check.mjs:31
- **Detail**: `#[0-9a-fA-F]{3,8}\b` matches `href="#bad"` and `&#123;`, and the check scans comments too. The current scope passes, but the next view added to `SCOPE` may trip it.
- **Fix**: Handle it when it happens: rename the anchor, or teach the matcher a colour context. Mention the false positive in the script header.
- **Decision**: FIXED — false positive documented in the `scripts/ui-literals-check.mjs` header

### F9 — Two Radix dependency styles

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json:37
- **Detail**: The all-in-one `radix-ui` package (added for `label.tsx`) now sits next to the per-package `@radix-ui/react-slot` used by `button.tsx`.
- **Fix**: Move `button.tsx` to `import { Slot } from "radix-ui"` and drop `@radix-ui/react-slot`.
- **Decision**: FIXED — `button.tsx` uses `Slot as SlotPrimitive` from `radix-ui`; `@radix-ui/react-slot` uninstalled

### F10 — AGENTS.md points into the change folder, which archiving will move

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md (`## UI`, first bullet)
- **Detail**: The rule records new tokens in `context/changes/ui-tokens-onboarding/tokens.md`. `/10x-archive` moves that folder to `context/archive/…`, which breaks the pointer.
- **Fix**: Before archiving, move `tokens.md` to a stable location (e.g. `context/foundation/tokens.md`) and update AGENTS.md and the comment in `global.css`.
- **Decision**: FIXED — moved to `context/foundation/tokens.md` (git mv); AGENTS.md, the `global.css` comment and `ui-theme-other-pages/change.md` updated (plan.md left as history)
