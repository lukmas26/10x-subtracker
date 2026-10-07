# UI tokens onboarding (`/subscriptions`) Implementation Plan

## Overview

Bring `/subscriptions` and the shared primitives it renders onto the design-system contract this repo already ships: values in `src/styles/global.css` (`:root` / `.dark`, published through `@theme inline`), components in `src/components/ui` (shadcn new-york). The app gets **two themes**:

- **light**: the default, a light counterpart of today's look with the same purple brand.
- **dark**: today's glass/cosmic look, moved into tokens.

The user switches with a toggle rendered by `Layout` on every page, and the choice is remembered in `localStorage`. The change ends with a kitchen-sink visual gate (both themes), a literal-scan check in CI and pre-commit, and an `AGENTS.md` rule, so the next views inherit the contract instead of copying literals.

Issue: [#12 [UI-01]](https://github.com/lukmas26/10x-subtracker/issues/12) · Branch: `ui01-tokens-onboarding`.

## Current State Analysis

From `research.md` (`## Summary`, `## Charges`):

- Tailwind 4 is set up correctly (`@tailwindcss/vite`, `@import "tailwindcss"`, `@custom-variant dark`, `@theme inline` at `global.css:1-4,75-111`), but the token layer is dead. The 9 files that render the view contain **70** hardcoded-value hits, **0** semantic token classes and **1** `@/components/ui` import (`SubmitButton.tsx:3`).
- `.dark` is never applied (`Layout.astro:14`), so the light shadcn-neutral `:root` is active and `body` is white (`global.css:122`). Each page paints a dark `bg-cosmic` (hex at `global.css:114`) over it. No `color-scheme` is set.
- Charges:
  - **C1**: palette literals over a dead token layer.
  - **C2**: error, success and focus colours are literals; `--destructive` is unused; inputs have no aria error wiring.
  - **C3**: glass panel, alerts and field markup are copy-pasted; `ui/` holds only `button.tsx` and an unused `LibBadge.astro`.
  - **C4**: `SubmitButton` overrides the `Button` variant; `Banner.astro` uses scoped hex CSS; Topbar links repeat literals.
  - **C5**: sign-in loses the destination (**deferred**).
- `FormField`, `SelectField`, `ServerError` and `SubmitButton` are also used by `SignInForm`/`SignUpForm`.
- `bg-cosmic` with hand-written `text-white` is also used by 5 other pages (`dashboard.astro`, `auth/signin.astro`, `auth/signup.astro`, `auth/confirm-email.astro`, `Welcome.astro`). Once `bg-cosmic` is driven by tokens and light is the default, they would render white text on a light background.

## Desired End State

- **Two themes.** Light is the default: no stored choice means light, whatever the system preference. Dark is applied as `class="dark"` on `<html>`. Every role token has a verified value in both `:root` (light) and `.dark` (dark), and `color-scheme` follows the theme.
- **Theme toggle.** A toggle rendered by `Layout` on every page switches the theme, stores `theme=light|dark` in `localStorage`, and has an accessible name and pressed state. An inline script in `<head>` applies a stored dark choice before first paint, so there is no light flash for dark users.
- **The view on the contract.** `/subscriptions` and the shared pieces it renders (`SubscriptionForm`, `FormField`, `SelectField`, `ServerError`, `SubmitButton`, `Topbar`, `Layout`, `Banner`, `ThemeToggle`) contain **0** hits from the hardcoded-value scan. They are built from `Card`, `Alert`, `Input`, `Label`, `Button` and token classes only, and they read correctly in both themes.
- **Error semantics.** Every input in an error state has `aria-invalid` and an `aria-describedby` pointing at its message. Focus rings come from `--ring` in both themes.
- **Other pages pinned dark.** The 5 other `bg-cosmic` pages are pinned to dark with `class="dark"` on their root wrapper and look exactly as they do today. Their migration is the separate change `ui-theme-other-pages`.
- **Visual gate.** `/dev/kitchen-sink` (dev only; 404 in production) shows all 7 states in both themes side by side. Screenshots at desktop and 375 px are saved in the change folder.
- **Guard.** `npm run lint:ui` fails on a literal in the scoped files and runs in CI and lint-staged. The UI section of `AGENTS.md` names the themes, the tokens, the components, the kitchen sink and the check.
- **Dark looks as before.** In dark, `/subscriptions` looks as it does today, apart from the accepted deltas listed under _Critical Implementation Details_.

### Key Discoveries:

- `Banner` is used only with `variant="error"` (`Layout.astro:23`).
- The smoke test asserts the empty-state copy `"No subscriptions yet"` (`scripts/smoke.mjs:129`), so that text must not change.
- The current shadcn `label` depends on the unified `radix-ui` package and ships a `"use client"` line. `AGENTS.md` forbids `"use client"`.
- `@custom-variant dark (&:is(.dark *))` (`global.css:4`) means both the `dark:` variants and the `.dark` custom-property values apply to any subtree under a `.dark` element. That is what makes the interim per-page pin work.
- `Topbar` is rendered only on `/subscriptions` and `/` (`Welcome.astro`), which is why the toggle lives in `Layout`.
- `confirm-email.astro:4` already uses `import.meta.env.DEV` as a dev/prod switch, and the kitchen sink reuses it.
- Husky + lint-staged run on pre-commit. CI runs `lint`, `test:smoke`, `astro check` and `build` (`.github/workflows/ci.yml:18-23`). `test:smoke` already globs `scripts/*.test.mjs`.
- No roadmap item has Change ID `ui-tokens-onboarding`, so the roadmap is not touched.

## What We're NOT Doing

- **Migrating the other 5 pages** (`dashboard`, `signin`, `signup`, `confirm-email`, Welcome/`/`). They are pinned dark here and migrated in the separate change `ui-theme-other-pages`. On those pages the toggle switches the stored theme but has no visible effect until they are migrated.
- **Following the system `prefers-color-scheme`.** Light is the default for everyone without a stored choice.
- **C5**: the sign-in → `/` redirect that loses the destination (`api/auth/signin.ts:19`). It gets its own change.
- shadcn `select` (Radix). `SelectField` keeps the native `<select>`.
- Removing the chart/sidebar tokens. They are kept for future shadcn chart/sidebar components.
- Installing Playwright or any screenshot-testing tool.
- Layout, typography or spacing redesign, and copy changes.

## Implementation Approach

Follow the `/10x-ui` order: **environment/library → token values → shared primitives → the one view → states/gate → guard**.

- After every visual phase, re-run the hardcoded-value scan on the view's files. The count must only go down (70 → … → 0); a count that goes up is a regression.
- From Phase 2 on, take desktop + 375 px screenshots of `/subscriptions` in **both** themes.

Dark values come from today's literals: Tailwind palette names → exact `oklch` values copied from `node_modules/tailwindcss/theme.css`, plus the two `bg-cosmic` hexes. Light values are the light counterpart of the same brand. Both sets are recorded in `context/changes/ui-tokens-onboarding/tokens.md`.

## Critical Implementation Details

- **Theme bootstrap ordering.** The stored theme must be applied before first paint. A small `<script is:inline>` at the top of `<head>` in `Layout.astro` reads `localStorage.theme` inside `try/catch` (storage can throw in private mode) and adds `dark` to `document.documentElement` only when the value is `"dark"`. Anything else, including errors, means light. The server always renders without the class. The toggle island hydrates later and reads the current state from the `<html>` class, not from storage, so it can't disagree with what is shown.
- **Interim pin.** The 5 other pages get `class="dark"` on their outermost wrapper. They then look dark whatever the `<html>` theme is, while `body` outside the wrapper follows the global theme. This is no regression: `body` is white there today too.
- **Uncommitted rule text and the 10x-cli block.** The `## UI` section in `AGENTS.md` is uncommitted work carried over onto this branch. It lands with this change (Phase 6 extends it). The uncommitted `CLAUDE.md` diff is the 10x-cli managed block from `chore/10x-cli-m2l5`. Leave it out of every commit in this change, and ask the user how they want it handled.
- **Accepted visual deltas (dark theme only;** the light theme is new): primary-button hover becomes `bg-primary/90` instead of `purple-500`; error text becomes `text-destructive` (red-400 value) instead of `red-300`; Topbar link hover becomes `text-foreground` instead of `purple-100`; shadcn `Card`/`Alert` internal spacing replaces hand-rolled paddings where the difference is ≤ 4px. Record each in `tokens.md`. Any other change in dark counts as drift.
- **`"use client"`**: strip it from every component `npx shadcn add` writes.
- **`SubmitButton` pending state** comes from `useFormStatus`, which the kitchen sink cannot trigger. Add an optional `pending` override prop (defaulting to the form status).

## Phase 1: Library and theme switching

### Overview

Put the components, the theme mechanism and the interim pin in place before any values change. Every page should look exactly as today. `/subscriptions` still uses literals, so it stays dark in both themes for now.

### Changes Required:

#### 1. shadcn components

**File**: `src/components/ui/{card,alert,input,label}.tsx` (new), `package.json`

**Intent**: Add the four registry components the view needs, so C3 has real targets.

**Contract**: `npx shadcn@latest add card alert input label`. Imports resolve through `@/lib/utils`. Remove `"use client"` from each new file. The new runtime dependency is `radix-ui` (for `label`). `button.tsx` is not overwritten.

#### 2. Theme bootstrap and colour scheme

**File**: `src/layouts/Layout.astro`, `src/styles/global.css`

**Intent**: Apply a stored dark choice before paint, and let native widgets follow the theme.

**Contract**: an inline head script as described under _Critical Implementation Details_ (`localStorage` key `theme`, values `light` | `dark`, default light). `color-scheme: light` on `:root` and `color-scheme: dark` on `.dark`, both in `global.css`.

#### 3. Theme toggle

**File**: `src/components/ThemeToggle.tsx` (new), `src/components/hooks/useTheme.ts` (new), `src/layouts/Layout.astro`

**Intent**: Give every page a way to switch theme.

**Contract**:

- `useTheme()` returns `{ theme, toggle }`. It reads the initial theme from the `<html>` class, and `toggle` flips the class and writes `localStorage.theme` inside `try/catch`.
- `ThemeToggle` is a shadcn `Button` (`variant="outline"`, `size="icon"`) with a lucide `Sun`/`Moon` icon, `aria-label="Toggle theme"` and `aria-pressed` set to whether dark is on.
- `Layout` renders it once as a small fixed-position control in a corner (`client:load`), above page content, so it doesn't cover the Topbar or form controls at 375 px.
- Colours come only from tokens.

#### 4. Interim dark pin for the other pages

**File**: `src/pages/dashboard.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`, `src/components/Welcome.astro`

**Intent**: Keep the not-yet-migrated pages exactly as they look today once light becomes the default and `bg-cosmic` turns token-driven.

**Contract**: add `dark` to the class list of each file's outermost wrapper (the `bg-cosmic` element). Add a one-line comment pointing to change `ui-theme-other-pages`. Nothing else changes in these files.

#### 5. Leftover cleanup

**File**: `src/components/ui/LibBadge.astro` (delete), `src/layouts/Layout.astro`

**Intent**: Leave only real shared components in `ui/`, and drop the scoped reset that preflight already covers.

**Contract**: delete `LibBadge.astro` (no importers). Remove the `<style>` block at `Layout.astro:40-47`. If `height: 100%` turns out to be load-bearing, express it as a utility class.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes
- `npm run lint` passes
- `npm run build` passes
- No `"use client"` in `src/` (`grep -rn "use client" src` returns nothing)
- `src/components/ui` contains exactly `alert.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`

#### Manual Verification:

- With no stored theme, a fresh load renders `<html>` without `dark`; after toggling and reloading, `<html>` has `dark` from first paint, with no light flash
- The toggle is reachable by keyboard and announced as a toggle with its pressed state
- All pages (`/`, `/subscriptions`, `/dashboard`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`) look as they do today at desktop and 375 px, in both toggle states

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Token values (light and dark)

### Overview

Define both palettes under role names and publish the new tokens. Components aren't changed yet, so the scan count stays at 70.

### Changes Required:

#### 1. `.dark` values (today's cosmic look)

**File**: `src/styles/global.css`

**Intent**: The `.dark` block becomes the dark palette, under role names.

**Contract**: `--background` ← `#0a0e1a`; `--foreground`, `--card-foreground`, `--popover-foreground`, `--primary-foreground` ← white; `--card` ← white/10; `--popover` ← cosmic base; `--primary` ← purple-600; `--muted-foreground` ← blue-100 at 70%; `--border` ← white/10; `--input` ← white/20; `--ring` ← purple-400; `--destructive` ← red-400.

#### 2. `:root` values (light, the default)

**File**: `src/styles/global.css`

**Intent**: A light counterpart of the same brand: light background, white cards with a border and shadow instead of glass, the same purple primary.

**Contract**: `--background` ← slate-50; `--foreground`, `--card-foreground`, `--popover-foreground` ← slate-900; `--card`, `--popover` ← white; `--primary` ← purple-600; `--primary-foreground` ← white; `--muted-foreground` ← slate-600; `--border` ← slate-200; `--input` ← slate-300; `--ring` ← purple-500; `--destructive` ← red-600. These are starting values. Phase 5's contrast check may adjust them, and `tokens.md` records the final ones.

#### 3. New role tokens (both themes)

**File**: `src/styles/global.css`

**Intent**: Cover the roles shadcn has no token for (C1, C2).

**Contract**: new variables in both `:root` and `.dark`, each published in `@theme inline` as `--color-<name>`:

| Token                    | light      | dark       |
| ------------------------ | ---------- | ---------- |
| `--background-highlight` | white      | `#0f1529`  |
| `--success`              | green-700  | green-300  |
| `--link`                 | purple-700 | purple-300 |
| `--heading-from`         | blue-700   | blue-200   |
| `--heading-to`           | purple-700 | purple-200 |

#### 4. Utilities from tokens

**File**: `src/styles/global.css`

**Intent**: Remove the last literals from the stylesheet's utilities, and give the gradient heading one definition.

**Contract**: `@utility bg-cosmic` uses `var(--background)` / `var(--background-highlight)` instead of hex (a cosmic gradient in dark, a subtle slate-50 → white gradient in light). A new `@utility text-heading` holds the gradient-clip heading (`--heading-from` → `--heading-to`, `bg-clip-text`, `text-transparent`).

#### 5. Value record

**File**: `context/changes/ui-tokens-onboarding/tokens.md` (new)

**Intent**: Record the values and their source, so the next session doesn't invent them again.

**Contract**: table of token → light value → dark value → source (Tailwind palette name / old hex / file:line it replaces), plus the accepted-deltas list. `global.css` gets a one-line comment above the `:root` block pointing to this file.

### Success Criteria:

#### Automated Verification:

- `npm run build` passes
- `npm run lint` passes
- New tokens are published in `@theme inline`: `--color-background-highlight`, `--color-success`, `--color-link`, `--color-heading-from`, `--color-heading-to` all appear inside that block in `global.css`
- `grep -nE "#[0-9a-fA-F]{3,8}" src/styles/global.css` matches nothing outside the `:root`/`.dark` blocks

#### Manual Verification:

- The 5 pinned pages and `/subscriptions` still look as they do today, in both toggle states (the cosmic background now comes from `.dark` tokens)
- `tokens.md` lists every new and reassigned token with its light and dark value and its source

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Shared primitives on the contract

### Overview

Rebuild the pieces the view composes on `ui/` components and tokens (C2, C3, C4). The auth forms also render these primitives, but inside their dark pin, so they stay dark there.

### Changes Required:

#### 1. Form fields

**File**: `src/components/form/FormField.tsx`, `src/components/form/SelectField.tsx`

**Intent**: One token-based field look, real error semantics, no duplicated class strings.

**Contract**: the public props of both stay unchanged. `FormField` renders `Label` + `Input`. `SelectField` renders `Label` + native `<select>` styled with the same token classes as `Input`; options use `bg-popover text-popover-foreground`, and the `slate-900` workaround is removed. In an error state, the control gets `aria-invalid="true"` and `aria-describedby="<id>-error"`, and the message element gets that id and uses `text-destructive`. Icons and placeholders use `text-muted-foreground`. Focus comes from `--ring`.

#### 2. Messages

**File**: `src/components/form/ServerError.tsx`, `src/components/ui/alert.tsx`, `src/components/Banner.astro`

**Intent**: One alert component for every status message (C3, C4).

**Contract**: `alert.tsx` gains a `success` variant (token `success`) alongside `default`/`destructive`. `ServerError` renders `<Alert variant="destructive">` with the same props API. `Banner.astro` drops its scoped CSS and renders the alert styling from tokens. It keeps `role="alert"`, and the unused `info`/`warning` variants are removed.

#### 3. Submit button

**File**: `src/components/form/SubmitButton.tsx`

**Intent**: The main action takes its colour from `--primary`, not from an override (C4).

**Contract**: `<Button type="submit" className="w-full">` with no colour classes. The spinner uses `border-primary-foreground/30 border-t-primary-foreground`. A new optional `pending?: boolean` prop overrides `useFormStatus().pending`.

#### 4. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Links and chrome read tokens, and the link style is defined once.

**Contract**: container uses `border-border`, `bg-card` and `text-muted-foreground`. Links use `text-link hover:text-foreground` with a `focus-visible` ring from `--ring`, defined once (a local class list constant or `@utility link`).

### Success Criteria:

#### Automated Verification:

- `npx astro check`, `npm run lint`, `npm run build` pass
- Hardcoded-value scan over `FormField.tsx`, `SelectField.tsx`, `ServerError.tsx`, `SubmitButton.tsx`, `Topbar.astro`, `Banner.astro`, `ThemeToggle.tsx` returns 0 hits
- `npm run smoke` passes against a local server with local Supabase

#### Manual Verification:

- Submitting the subscription form empty: each invalid field shows its message and is announced as invalid with that message as its description
- Tabbing through the form in both themes: every control, including the submit button and the theme toggle, shows the brand focus ring
- `/auth/signin` and `/auth/signup` (dark-pinned) still look coherent at desktop and 375 px
- With `SUPABASE_URL` unset, the config banner is readable in both themes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: The `/subscriptions` view

### Overview

Rebuild the page itself from components and tokens. From here on it follows the toggle: light by default, dark on demand. The scan of the view's files reaches 0.

### Changes Required:

#### 1. Page markup

**File**: `src/pages/subscriptions.astro`

**Intent**: Glass sections, heading, messages and list read the contract (C1–C3), so they render correctly in both themes.

**Contract**:

- Both sections are `Card`: glass via `bg-card` + `backdrop-blur-xl` in dark, a bordered card in light, with shape and padding as today.
- The h1 uses `text-heading`; the h2 uses a foreground token.
- Messages: the saved message is `<Alert variant="success" role="status">`, and the load error is `<Alert variant="destructive">` (or `ServerError`).
- Secondary text uses `text-muted-foreground`, and the list uses `divide-border`.
- The `bg-cosmic` wrapper stays and is not pinned.
- Copy is unchanged, including `"No subscriptions yet — add your first one above."`.
- `Card`/`Alert` render statically, without `client:` directives.

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan over the view files (`subscriptions.astro`, `SubscriptionForm.tsx`, `FormField.tsx`, `SelectField.tsx`, `ServerError.tsx`, `SubmitButton.tsx`, `Topbar.astro`, `Layout.astro`, `Banner.astro`, `ThemeToggle.tsx`) returns 0 hits
- `npx astro check`, `npm run lint`, `npm run build` pass
- `npm run smoke` passes (empty-state text and the add flow unchanged)

#### Manual Verification:

- In dark, `/subscriptions` at desktop and 375 px matches the pre-change screenshot except for the accepted deltas in `tokens.md`
- In light, `/subscriptions` at desktop and 375 px reads as the same product (purple brand, readable text, visible card edges)
- Empty list, populated list, `?saved=1` and a server error render correctly in both themes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: States and visual gate

### Overview

One page that shows every state of the view's building blocks in both themes at once. It is screenshotted at two widths and kept as review evidence.

### Changes Required:

#### 1. Kitchen sink page

**File**: `src/pages/dev/kitchen-sink.astro` (new)

**Intent**: Make the states the happy path never exercises (disabled, error, focus, loading, empty) visible in both themes.

**Contract**: returns a 404 response unless `import.meta.env.DEV`. It renders two columns, light and dark (the dark column wrapped in `class="dark"`), each inside `bg-cosmic`, using fixture data and the real components only:

- `Card` panels
- `FormField`/`SelectField` in default, error and disabled states
- `SubmitButton` default, disabled and `pending`
- `Alert` success, destructive and default
- the list populated and empty
- `Topbar` links and `ThemeToggle`

Each block is labelled with its state. The page contains no literals (it is in the scan scope). Hover and focus-visible are captured by interacting with the page during the screenshot. The columns stack at 375 px.

#### 2. Screenshots

**File**: `context/changes/ui-tokens-onboarding/screenshots/` (new)

**Intent**: Keep the gate's evidence next to the plan.

**Contract**: `kitchen-sink-desktop.png`, `kitchen-sink-375.png`, and `subscriptions-{light,dark}-{desktop,375}.png`, plus `focus-visible-{light,dark}.png` and `hover.png` crops. A short `screenshots/README.md` maps each file to the 7-state matrix, and records any light-value adjustments made after the contrast check (also mirrored in `tokens.md`).

### Success Criteria:

#### Automated Verification:

- `npm run build` passes, and the production preview returns 404 for `/dev/kitchen-sink`
- Hardcoded-value scan over `src/pages/dev/kitchen-sink.astro` returns 0 hits

#### Manual Verification:

- 7-state matrix complete in both themes: default, hover, focus-visible, disabled, error, empty, loading. Each is shown, or marked N/A with a reason in `screenshots/README.md` (the list-loading skeleton is N/A because the page is server-rendered)
- Contrast check in both themes: body text, muted text, link, destructive and success text, and the focus ring are legible (no WCAG audit; flag and fix anything hard to read)
- Screenshots saved at desktop and 375 px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Make it stick

### Overview

Tell the next agent where to look, and fail the build when it doesn't.

### Changes Required:

#### 1. Literal check

**File**: `scripts/ui-literals-check.mjs` (new), `scripts/ui-literals-check.test.mjs` (new), `package.json`

**Intent**: Automate the `/10x-ui` hardcoded-value scan for the files this change cleaned, following the repo's dependency-free script pattern (`smoke.mjs` + `smoke-match.mjs`).

**Contract**:

- Exports a pure matcher (line → hits) plus a CLI.
- The CLI checks a scope list declared at the top of the script: the 10 view files listed in Phase 4, plus `src/components/hooks/useTheme.ts` and `src/pages/dev/kitchen-sink.astro`. With file arguments (lint-staged), it checks only the arguments that are in scope.
- On a hit, it prints `file:line: literal` and exits 1.
- The regex is the `/10x-ui` scan: hex/rgb/hsl/oklch, arbitrary `-[Npx|rem]`, palette and white/black colour classes.
- Unit tests cover a palette class, `bg-white/10`, a hex, an arbitrary value, and token classes that must pass (`bg-primary`, `text-muted-foreground`, `text-link`). They are picked up by the existing `test:smoke` glob.
- New script: `"lint:ui": "node scripts/ui-literals-check.mjs"`.

#### 2. Wiring

**File**: `.github/workflows/ci.yml`, `package.json` (`lint-staged`)

**Intent**: Run the check where literals would enter: pre-commit and CI.

**Contract**: CI runs `npm run lint:ui` after `npm run lint`. lint-staged runs `node scripts/ui-literals-check.mjs` for `*.{ts,tsx,astro}` alongside `eslint --fix`.

#### 3. Agent rule

**File**: `AGENTS.md` (`## UI` section; `AGENTS.md` has no 10x-cli managed block)

**Intent**: Turn the existing two-line rule into one with concrete names and pointers.

**Contract**: the section says:

- there are two themes, light (default, `:root`) and dark (`.dark` on `<html>`, toggled by `ThemeToggle`, stored in `localStorage`), and every new colour is a token with both a light and a dark value in `global.css`, recorded in `tokens.md`;
- the role tokens to use (list them);
- which components to reuse (`Card`, `Alert` incl. `success`, `Input`, `Label`, `Button`, plus `FormField`/`SelectField`/`SubmitButton`/`ServerError`), and that missing ones are added with `npx shadcn@latest add` (strip `"use client"`);
- no palette classes, hex/oklch or arbitrary values in views;
- the pages still pinned dark until `ui-theme-other-pages`;
- `/dev/kitchen-sink` is the place to show new states in both themes;
- `npm run lint:ui` enforces this, and a newly cleaned view is added to its scope.

It also mentions the command in `## Commands`.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` passes on the cleaned scope
- `npm run test:smoke` passes, including the new matcher tests
- `npm run lint`, `npx astro check`, `npm run build` pass
- Adding `text-purple-300` to `subscriptions.astro` makes `npm run lint:ui` exit 1 with the file:line (revert afterwards)

#### Manual Verification:

- A commit that stages a scoped file with a literal is blocked by the pre-commit hook
- The `## UI` section of `AGENTS.md` reads as a complete instruction to an agent that hasn't seen this change

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `scripts/ui-literals-check.test.mjs`: the matcher flags palette and white/black classes (with and without `/opacity`), hex, `oklch(`, and arbitrary px/rem values. It passes token classes and non-colour utilities (`backdrop-blur-xl`, `rounded-2xl`, `p-5`).

### Integration Tests:

- `npm run smoke` after Phases 3 and 4: the sign-up/sign-in/add-subscription flow and the empty-state copy are unchanged.

### Manual Testing Steps:

1. Before Phase 1, take baseline screenshots of `/subscriptions` (empty and populated) and of the 5 other pages at desktop and 375 px.
2. After each visual phase, re-take `/subscriptions` in both themes and re-run the scan on the view files. Record the count in the commit message.
3. Theme persistence: toggle to dark, reload, open a new tab, then clear storage. Expect dark with no flash, then dark again, then back to light.
4. Keyboard-only pass over `/subscriptions` in both themes: Tab order (toggle included), a visible ring on every control, Enter submits.
5. Submit invalid data and check the aria wiring in the devtools accessibility pane.
6. With Supabase env unset: the banner in both themes.

## Performance Considerations

There is one new hydrated island (`ThemeToggle`, `client:load`, tiny) and one inline head script of a few lines, which runs before paint by design. `Card`/`Alert` render statically.

## Migration Notes

There is no data to migrate. Existing users have no stored theme, so they get light on `/subscriptions` and dark (pinned) everywhere else until `ui-theme-other-pages` lands.

## References

- Research and charges: `context/changes/ui-tokens-onboarding/research.md` (`## Charges` C1–C5)
- Change scope: `context/changes/ui-tokens-onboarding/change.md` (`### UI scope`)
- Follow-up change: `context/changes/ui-theme-other-pages/change.md`
- Prior style decision: `context/archive/2026-10-02-first-subscription-on-list/plan.md:182`
- Script pattern to follow: `scripts/smoke.mjs`, `scripts/smoke-match.mjs`, `scripts/*.test.mjs`
- `/10x-ui` skill: `.claude/skills/10x-ui/SKILL.md`, merge checklist `references/ui-quality-checklist.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Library and theme switching

#### Automated

- [x] 1.1 `npx astro check` passes — 44a748b
- [x] 1.2 `npm run lint` passes — 44a748b
- [x] 1.3 `npm run build` passes — 44a748b
- [x] 1.4 No `"use client"` in `src/` — 44a748b
- [x] 1.5 `src/components/ui` contains exactly alert, button, card, input, label — 44a748b

#### Manual

- [x] 1.6 Default light, stored dark applied before first paint — 44a748b
- [x] 1.7 Toggle keyboard-reachable with name and pressed state — 44a748b
- [x] 1.8 All pages look as today in both toggle states — 44a748b

### Phase 2: Token values (light and dark)

#### Automated

- [x] 2.1 `npm run build` passes — b68e821
- [x] 2.2 `npm run lint` passes — b68e821
- [x] 2.3 New tokens published in `@theme inline` — b68e821
- [x] 2.4 No hex in `global.css` outside the `:root`/`.dark` blocks — b68e821

#### Manual

- [x] 2.5 Pinned pages and `/subscriptions` unchanged in both toggle states — b68e821
- [x] 2.6 `tokens.md` lists every token with light and dark value and source — b68e821

### Phase 3: Shared primitives on the contract

#### Automated

- [x] 3.1 `npx astro check`, `npm run lint`, `npm run build` pass — 961789a
- [x] 3.2 Scan over the 7 shared files returns 0 hits — 961789a
- [x] 3.3 `npm run smoke` passes locally — 961789a

#### Manual

- [x] 3.4 Invalid fields announced as invalid with their message — 961789a
- [x] 3.5 Brand focus ring on every control in both themes — 961789a
- [x] 3.6 Dark-pinned auth pages coherent at desktop and 375 px — 961789a
- [x] 3.7 Config banner readable in both themes — 961789a

### Phase 4: The `/subscriptions` view

#### Automated

- [x] 4.1 Scan over the view files returns 0 hits — 75f47d7
- [x] 4.2 `npx astro check`, `npm run lint`, `npm run build` pass — 75f47d7
- [x] 4.3 `npm run smoke` passes — 75f47d7

#### Manual

- [x] 4.4 Dark matches baseline except accepted deltas — 75f47d7
- [x] 4.5 Light reads as the same product — 75f47d7
- [x] 4.6 Empty, populated, saved and error variants correct in both themes — 75f47d7

### Phase 5: States and visual gate

#### Automated

- [x] 5.1 Build passes and production preview 404s `/dev/kitchen-sink` — 6effd53
- [x] 5.2 Scan over the kitchen sink returns 0 hits — 6effd53

#### Manual

- [x] 5.3 7-state matrix complete in both themes — 6effd53
- [x] 5.4 Contrast check in both themes — 6effd53
- [ ] 5.5 Screenshots saved at desktop and 375 px

### Phase 6: Make it stick

#### Automated

- [x] 6.1 `npm run lint:ui` passes on the cleaned scope
- [x] 6.2 `npm run test:smoke` passes with matcher tests
- [x] 6.3 `npm run lint`, `npx astro check`, `npm run build` pass
- [x] 6.4 An injected literal makes `npm run lint:ui` exit 1

#### Manual

- [x] 6.5 Pre-commit hook blocks a staged literal
- [x] 6.6 `AGENTS.md` UI section reads as a complete instruction
