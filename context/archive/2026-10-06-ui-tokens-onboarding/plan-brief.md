# UI tokens onboarding (`/subscriptions`) — Plan Brief

> Full plan: `context/changes/ui-tokens-onboarding/plan.md`
> Research: `context/changes/ui-tokens-onboarding/research.md` (charges C1–C5)

## What & Why

Move `/subscriptions` onto the design-system contract the repo already ships: tokens in `global.css`, shadcn components in `src/components/ui`. The app gets two themes: **light (default)** and **dark** (today's cosmic look), switched by a toggle on every page. The goal is that the next views inherit tokens and components instead of copying ~70 literal colour classes, and that a check stops the drift from coming back.

## Starting Point

Tailwind 4 and the shadcn token layer are set up correctly, but they are dead. The view's 9 files have 70 hardcoded-value hits, 0 token classes and 1 `ui/` import. `.dark` is never applied: the light shadcn theme is active under a hand-painted dark "cosmic/glass" look. Panels, alerts and form fields are copy-pasted, `SubmitButton` overrides `Button`, and inputs have no aria error wiring. Five other pages share the same dark literals.

## Desired End State

`/subscriptions` renders in light by default and in dark on demand. In dark it looks as it does today (with a few listed deltas), and every colour comes from a role token with a light and a dark value. Every block is a `Card`/`Alert`/`Input`/`Label`/`Button`. A toggle on every page remembers the choice in `localStorage` without a flash. Errors are announced to screen readers and the focus ring is consistent. A dev-only kitchen sink shows all 7 states in both themes. `npm run lint:ui` fails in CI and pre-commit if a literal comes back, and `AGENTS.md` tells the next agent which tokens and components to use. The other 5 pages stay dark (pinned) until their own change.

## Key Decisions Made

| Decision                       | Choice                                                                                                      | Why (1 sentence)                                                                  | Source          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| Scope                          | `/subscriptions` + global tokens + the shared pieces it renders + the theme mechanism                       | `/10x-ui` one-view rule                                                           | Research / Plan |
| Themes                         | Two: light (default, `:root`) and dark (`.dark` on `<html>`); system preference not followed                | User decision: light is the default                                               | Plan            |
| Switching and storage          | Toggle + `localStorage` (`theme`), inline `<head>` script applies dark before paint                         | User choice; instant switch with no server round trip                             | Plan            |
| Light palette                  | Light counterpart of cosmic: slate-50 background, white bordered cards, purple-600 primary, purple-700 link | One brand in both themes; components unchanged, only values differ                | Plan            |
| Toggle placement               | Floating control rendered by `Layout` on every page                                                         | User choice; Topbar exists only on 2 pages                                        | Plan            |
| Other 5 pages                  | Pinned dark (`class="dark"` on their wrapper) now; migrated in change `ui-theme-other-pages`                | Light default would make their `text-white` unreadable; keeps the one-view rule   | Plan            |
| Components                     | shadcn `card`, `alert` (+ `success`), `input`, `label`; native `<select>` kept; `radix-ui` added            | AGENTS.md "shadcn registry first"; Radix select would change form behaviour       | Plan            |
| Guard                          | `scripts/ui-literals-check.mjs` → `npm run lint:ui`, in CI + lint-staged, plus the AGENTS.md rule           | Same pattern as `smoke.mjs`; the rule alone already existed and the views drifted | Plan            |
| Cleanup                        | Delete `LibBadge.astro` and the Layout reset; keep chart/sidebar tokens                                     | `ui/` holds only real components                                                  | Plan            |
| Visual gate                    | Dev-only `/dev/kitchen-sink`, light and dark side by side, screenshots at desktop and 375 px                | Every state in both themes without Supabase or a test runner                      | Plan            |
| C5 (sign-in loses destination) | Deferred to its own change                                                                                  | Auth-flow + smoke change, not tokens                                              | Research        |

## Scope

**In scope:**

- Light and dark values for every role token, plus new tokens (`background-highlight`, `success`, `link`, `heading-from/to`)
- `ThemeToggle`, `useTheme` and the head bootstrap script
- `FormField`, `SelectField`, `ServerError`, `SubmitButton`, `Banner`, `Topbar`, `Layout`, `subscriptions.astro`
- The dark pin on the 5 other pages
- The kitchen sink, screenshots, `tokens.md`, `lint:ui`, and the AGENTS.md UI rule

**Out of scope:** migrating dashboard, auth and landing to both themes (`ui-theme-other-pages`); following `prefers-color-scheme`; C5; shadcn `select`; Playwright; layout or copy redesign.

## Architecture / Approach

Values (`:root` light / `.dark` dark) → published by `@theme inline` → role classes → shadcn components in `ui/` → the shared form primitives → the view. The theme is the `dark` class on `<html>`. It is set before paint by an inline script from `localStorage` and flipped by `ThemeToggle`. A `dark` class on any wrapper pins that subtree to dark. Order: library + theme mechanism → tokens → primitives → view → states → guard. The scan count on the view files must drop from 70 to 0.

## Phases at a Glance

| Phase                            | What it delivers                                                           | Key risk                                |
| -------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| 1. Library and theme switching   | shadcn components, toggle + bootstrap script, dark pin on 5 pages, cleanup | Flash of light theme for dark users     |
| 2. Token values (light and dark) | Both palettes as role tokens + `tokens.md`                                 | Light values with weak contrast         |
| 3. Shared primitives             | Token-based fields with aria, Alert messages, plain Button, Topbar         | Auth pages regress (shared primitives)  |
| 4. The view                      | `/subscriptions` at 0 scan hits, correct in both themes                    | Smoke copy changed by accident          |
| 5. States and visual gate        | Kitchen sink, both themes, 7 states, screenshots                           | Kitchen sink drifts from the real view  |
| 6. Make it stick                 | `lint:ui` in CI + pre-commit, AGENTS.md rule                               | Scope list not extended for later views |

**Prerequisites:** local dev server; local Supabase for `npm run smoke`; baseline screenshots of all 6 pages taken before Phase 1.
**Estimated effort:** ~3 sessions across 6 phases.

## Open Risks & Assumptions

- Until `ui-theme-other-pages` lands, users see light `/subscriptions` and dark sign-in/dashboard/landing, and the toggle has no visible effect on those pages.
- The light values are starting values. The Phase 5 contrast check may adjust them, and `tokens.md` records the final ones.
- Accepted dark deltas: button hover at `primary/90`, error text at the red-400 value, link hover to foreground, and small shadcn spacing differences.
- The uncommitted `## UI` block in `AGENTS.md` lands with this change. The `CLAUDE.md` 10x-cli diff stays out.

## Success Criteria (Summary)

- `/subscriptions` works in light (default) and dark, built only from tokens and `ui/` components (0 scan hits). In dark it matches today's look.
- The theme choice survives a reload with no flash, and the toggle is keyboard and screen-reader accessible.
- A literal colour reintroduced in the cleaned files fails pre-commit and CI.
