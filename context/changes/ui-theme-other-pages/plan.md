# Theme the remaining pages (auth, dashboard, landing) Implementation Plan

## Overview

Move the five views still pinned dark — sign in, sign up, confirm email, dashboard and the landing page — onto the design-system contract that `ui-tokens-onboarding` (UI-01) set up: role tokens from `src/styles/global.css` and components from `src/components/ui/`. Each page loses its interim `dark` pin, renders correctly in both themes, and joins the `npm run lint:ui` scope. The landing page and dashboard also get SubTracker copy in place of the starter's. When the last pin is gone, the theme toggle has a visible effect on every page (UI-01 impl-review F6), and the "Pinned dark" rule leaves `AGENTS.md`.

Issue: [#13 [UI-02]](https://github.com/lukmas26/10x-subtracker/issues/13).

## Current State Analysis

- **Pins.** Each of the five views wraps itself in `class="dark bg-cosmic …"` with a "Pinned dark until change ui-theme-other-pages" comment: `src/pages/auth/signin.astro:9-10`, `src/pages/auth/signup.astro:9-10`, `src/pages/auth/confirm-email.astro:22-23`, `src/pages/dashboard.astro:8-9`, `src/components/Welcome.astro:5-6`.
- **Literal counts** (the `lint:ui` matcher, `scripts/ui-literals-check.mjs`):

  | File                                                          | Literals |
  | ------------------------------------------------------------- | -------- |
  | `src/components/Welcome.astro`                                | 40       |
  | `src/pages/dashboard.astro`                                   | 11       |
  | `src/pages/auth/signin.astro`                                 | 7        |
  | `src/pages/auth/signup.astro`                                 | 7        |
  | `src/pages/auth/confirm-email.astro`                          | 7        |
  | `src/components/auth/PasswordToggle.tsx`                      | 2        |
  | `src/components/auth/SignUpForm.tsx`                          | 1        |
  | `src/components/auth/SignInForm.tsx`, `src/pages/index.astro` | 0        |

- **The `/10x-ui` charges** (this change has no `research.md`; the audit is recorded here):

  | #   | Category                     | Location                                                                                                                                                                                                         | Effect on the user                                                                                                                             | Phase |
  | --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
  | C1  | Missing tokens               | the three auth pages, `:10-21` (`bg-white/10`, `text-white`, `text-blue-100/60`, `text-purple-300`, `from-blue-200 to-purple-200`)                                                                               | The pages are dark-only. In light, the toggle appears to do nothing.                                                                           | 1     |
  | C2  | Missing tokens               | `PasswordToggle.tsx:13` (`text-white/40`, `hover:text-white/70`); `SignUpForm.tsx:59` (`text-blue-100/50`)                                                                                                       | Once unpinned, the eye icon and the password hint would be white on a light field, so invisible in light.                                      | 1     |
  | C3  | Missing shared component     | `dashboard.astro:19-24`: a hand-rolled `<button>`                                                                                                                                                                | It is a second Sign out button style, with no `focus-visible` ring.                                                                            | 2     |
  | C4  | Accidental architecture      | `dashboard.astro:14-17`; `Welcome.astro:24-27, 63-110`; `Layout.astro:11`                                                                                                                                        | The first screen describes "10x Astro Starter" rather than the product, and the dashboard is a dead end with no way to reach `/subscriptions`. | 2, 3  |
  | C5  | Missing tokens and component | `Welcome.astro:8-15` (orb palette classes, arbitrary `h-[350px]`/`blur-[120px]`, inline `rgba()` star field); `:23` (three-stop gradient); `:30-41` (hand-rolled CTA links); `:47-110` (copy-pasted glass cards) | It cannot render in light, and its decoration is literals that `lint:ui` rejects.                                                              | 3     |

- **Pattern to copy.** `/subscriptions` (`src/pages/subscriptions.astro:28-29, 37-67`) already shows the target shape:
  - each panel is `Card` with the class string `"gap-0 rounded-2xl p-5 backdrop-blur-xl sm:p-8 dark:shadow-none"`;
  - headings use `text-heading`, secondary text uses `text-muted-foreground`, and body text uses `text-card-foreground`.

  The same class string is copied in `src/pages/dev/kitchen-sink.astro:51`.

- **Shared components already exist.** `Card`, `Button` (variants `default` and `outline`; `asChild` through `radix-ui` `Slot`), `Alert`, `Input` and `Label` are in `src/components/ui/`. The forms already use `FormField`, `SubmitButton` and `ServerError`, which are on tokens. No `shadcn add` is needed.
- **Dark baseline.** Today's dark look is the reference. Any dark difference has to be listed under "Accepted visual deltas" in `context/foundation/tokens.md`, which currently holds 1–16; anything not listed counts as drift.
- **Lessons.** `context/foundation/lessons.md` holds one rule, about atomic multi-table writes. It doesn't apply here, because nothing in this change writes data.

## Desired End State

- **Both themes.** All five views render in light (the default) and dark, built only from role tokens and `src/components/ui` components. None has a `dark` pin or a "Pinned dark" comment.
- **Dark baseline.** In dark, every view matches the baseline screenshots, except for the changes listed in `tokens.md` (new items 17 onward) and the agreed copy changes.
- **Landing decoration.** It is dark-only, driven entirely by the token layer: glow and star tokens are `transparent` in light, and the markup has no `dark:` classes for the decoration.
- **Copy.** The landing page and the dashboard carry the agreed SubTracker copy, and the default page title is "SubTracker".
- **`lint:ui`.** Its `SCOPE` includes every file listed under "Literal counts" and still passes.
- **`AGENTS.md`.** The `## UI` section has no "Pinned dark" bullet and lists the new tokens and utility.
- **Visual gate.** The kitchen sink shows the new states, and `context/changes/ui-theme-other-pages/screenshots/` holds the screenshots listed in Phase 4, with the 7-state matrix mapped in its `README.md`.

**Verification:** `npm run lint:ui`, `npm run lint`, `npx astro check`, `npm run build`, `npm run test:smoke`, a local `npm run smoke`, a `grep` for `dark bg-cosmic` and "Pinned dark", and the screenshot set.

### Key Discoveries:

- `Layout.astro:17-22` sets `.dark` on `<html>` before first paint. With the pins removed, the custom variant `@custom-variant dark (&:is(.dark *))` in `global.css:4` makes every page follow the toggle with no further wiring.
- **Dark-only decoration through tokens.** A token whose light value is `transparent` makes an element disappear in light without any `dark:` class. That keeps dark mode at the token layer, as `/10x-ui` requires ("a dark-mode pass that edits component classes is the missing-tokens charge in disguise").
- **Orb sizes match exactly.** Tailwind 4 spacing is fractional, so `size-87.5` is 350 px, `size-75` is 300 px and `size-62.5` is 250 px. Orb sizes stay identical without arbitrary values.
- **Blurs need named values.** The blurs (100, 120 and 140 px) have no standard Tailwind class. They become named `--blur-*` theme values in `@theme`, so the dark look stays identical.
- The landing heading's blue-200 → purple-200 is the same pair as `--heading-from` / `--heading-to` in dark. Only the pink-200 end changes.
- `text-link` in dark is purple-300, the exact colour of the landing icons and the auth links, and `text-muted-foreground` in dark is blue-100/70, the exact colour of the landing hero paragraph. Those map with no visual change.
- `scripts/smoke.mjs` asserts no copy from these pages (its only body checks are on `/subscriptions`, `:110, :129`), so the copy changes cannot break smoke.

## What We're NOT Doing

- **No landing decoration in light.** Light gets a plain `bg-cosmic` landing; the orbs and stars are dark-only, by decision.
- **No three-stop hero gradient.** The landing heading uses the shared two-stop `text-heading`, and the pink end becomes an accepted dark delta.
- **No new shadcn components and no new dependencies.**
- **No copy changes beyond the agreed strings** for the landing page, the dashboard and the default `Layout` title. The auth pages keep their wording.
- **No Polish UI copy.** The UI stays English.
- **No product claims beyond what exists.** In particular, the copy does not mention recommendations or spending summaries.
- **No `Topbar` on the dashboard, landing or auth pages.** The dashboard gets one "Go to subscriptions" button, and the landing page keeps its existing `Topbar`.
- **No changes to routing, middleware, auth handlers or `scripts/smoke.mjs`.**
- **No retroactive work on UI-01's open plan check 5.5** (its screenshots).
- **No Playwright or other screenshot tooling.** The gate is the kitchen sink plus browser screenshots.

## Implementation Approach

The order follows `/10x-ui` (library → token values → view → states). There is no library step, because every component already exists. Each page is migrated in its own phase and closed completely in that phase: pin removed, literals replaced, file added to `SCOPE`. No phase leaves a page half-migrated. Phase 1 extracts the shared panel class first, so the auth pages and the dashboard reuse the `/subscriptions` look instead of making a fourth and fifth copy of it. The landing page, which carries the only new design decisions, comes third. Phase 4 adds the states, the gate and the rule.

The screenshot gate needs a browser tool (Claude in Chrome, or the browser pane in the desktop app), which the user will enable. A dark baseline of the five views is captured **before** any edit. Without it, "dark matches today" cannot be checked.

## Critical Implementation Details

- **Browser tool and server check before Phase 1.**
  - Confirm that a browser tool is available. If it is not, stop and tell the user. Do not improvise capture, and do not skip the gate.
  - Then follow the `AGENTS.md` check for a server already listening on :4321/:8787, and ask before starting one.
  - Capture `screenshots/baseline/<page>-dark-{desktop,375}.png` for `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email` and `/dashboard` (signed in) from the unmodified pages.
- **Kitchen-sink shots must be taken in light.** The kitchen sink's light column is only light while `<html>` is light (see the archived UI-01 `screenshots/README.md`). Take kitchen-sink screenshots with the global theme set to light.
- **Parallel work with `edit-subscription`.** That change may run at the same time in another agent, in its own worktree and on its own dev-server port; keep this change's server and browser on a different port, and make sure screenshots come from this worktree's server. Local Supabase is shared: if smoke or a signed-in screenshot fails because the test account vanished, check whether the local database was reset before debugging the page. `edit-subscription` adds smoke steps and matcher tests, so criteria count "all steps pass", not a fixed number.
- **`confirm-email` content depends on the environment.** It renders different text under `import.meta.env.DEV` (auto-confirmed) than in production. Both variants share the same markup, so check one locally; the production variant differs only in strings.

## Phase 1: Auth pages

### Overview

Move `/auth/signin`, `/auth/signup` and `/auth/confirm-email` (with `PasswordToggle` and the sign-up password hint) onto tokens and `Card`, through one shared panel class. Closes C1 and C2.

### Changes Required:

#### 1. Shared panel class

**File**: `src/lib/styles.ts` (new); `src/pages/subscriptions.astro`; `src/pages/dev/kitchen-sink.astro`

**Intent**: Extract the panel class string that `/subscriptions` and the kitchen sink each define locally, so every glass panel in the app shares one definition. Its comment moves with it: glass panel in dark, bordered card with a shadow in light.

**Contract**: `export const panelClass = "gap-0 rounded-2xl p-5 backdrop-blur-xl sm:p-8 dark:shadow-none";`. `subscriptions.astro:29` and `kitchen-sink.astro:51` import it in place of their local `sectionClass`. If `edit-subscription` has already merged `src/pages/subscriptions/[id]/edit.astro` with its own copy of the string, that page imports `panelClass` too. `/subscriptions` must render unchanged.

#### 2. Auth pages

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Remove the `dark` pin and its comment. The wrapper keeps `bg-cosmic flex min-h-screen items-center justify-center p-4`. The inner panel becomes `Card` with `panelClass` plus the page's width and alignment (`w-full max-w-sm`; `text-center` on confirm-email), keeping today's `p-8` padding at every width. The `h1` uses `text-heading` in place of the gradient literals. Secondary text uses `text-muted-foreground`, and links use `text-link hover:underline` plus the Topbar's focus ring.

**Contract**: No `dark` class, no palette class and no arbitrary value remains. All strings, routes and the `serverError` / `client:load` wiring stay as they are. Each file is added to `SCOPE` in `scripts/ui-literals-check.mjs`.

#### 3. Auth form pieces

**File**: `src/components/auth/PasswordToggle.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: The eye icon uses `text-muted-foreground`, turning `text-foreground` on hover, and gets the shared `focus-visible:ring-3 focus-visible:ring-ring/50` ring with `rounded-sm outline-none`, because it is a keyboard-reachable control that has no visible focus today. The password hint uses `text-muted-foreground`.

**Contract**: Same props, `aria-label` and position. `PasswordToggle.tsx`, `SignInForm.tsx` and `SignUpForm.tsx` are added to `SCOPE`.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` passes with the six new `SCOPE` entries (three pages, three auth components)
- `npm run lint`, `npx astro check` and `npm run build` pass
- No `dark bg-cosmic` and no "Pinned dark" remain in the three auth pages (`grep`)
- Local `npm run smoke` passes (all steps)

#### Manual Verification:

- In dark, the three auth pages match their baseline screenshots except for listed deltas
- In light, the three auth pages read as the same product as `/subscriptions` at desktop and 375 px
- The password eye icon is visible in both themes and shows a focus ring when reached with Tab
- `/subscriptions` looks unchanged after the panel-class extraction
- Screenshots saved: `signin`, `signup` and `confirm-email`, each `-{light,dark}-{desktop,375}.png`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dashboard

### Overview

Move `/dashboard` onto `Card` and `Button`, replace its starter sentence with SubTracker copy, and add a way to reach `/subscriptions`. Closes C3 and the dashboard part of C4.

### Changes Required:

#### 1. Dashboard view

**File**: `src/pages/dashboard.astro`

**Intent**: Remove the pin and its comment. The panel becomes `Card` with `panelClass` and `text-center`, and the `h1` uses `text-heading`. "Welcome, <email>" keeps the email emphasised in `text-card-foreground`. The starter sentence is replaced. The hand-rolled Sign out button becomes `Button variant="outline"` in the existing sign-out form. A new primary `Button asChild` wraps a link to `/subscriptions`, placed before Sign out.

**Contract**: The copy is exactly:

- `h1`: "Dashboard"
- "Welcome, <email>"
- "Your subscriptions live on the Subscriptions page."
- buttons: "Go to subscriptions" (link, `href="/subscriptions"`) and "Sign out" (`POST /api/auth/signout`, unchanged)

The file is added to `SCOPE`.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` passes with `dashboard.astro` in `SCOPE`
- `npm run lint`, `npx astro check` and `npm run build` pass
- Local `npm run smoke` passes (all steps) (dashboard render, sign-out and redirect steps)

#### Manual Verification:

- In dark, the dashboard matches the baseline except for listed deltas and the agreed copy
- In light, the dashboard is readable and the same product as `/subscriptions` at desktop and 375 px
- "Go to subscriptions" opens `/subscriptions`; Sign out signs out; both show a focus ring when reached with Tab
- Screenshots saved: `dashboard-{light,dark}-{desktop,375}.png`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Landing page

### Overview

Tokenize the landing decoration (dark-only), move the hero, CTAs and feature cards onto `text-heading`, `Button` and `Card`, and replace the starter copy with SubTracker copy. Closes C5 and the landing part of C4.

### Changes Required:

#### 1. Decoration tokens

**File**: `src/styles/global.css`

**Intent**: Add colour tokens for the three orb tints and the star dots. In dark they take today's values exactly; in light they are `transparent`, so the decoration disappears at the token layer. Add a `bg-starfield` utility that reproduces today's three dot layers from the star token, and named blur values for the three orb blurs.

**Contract**: Colour tokens, each in `:root` and `.dark` and published in `@theme inline` as `--color-<name>`:

| Token              | Light         | Dark                  | Replaces           |
| ------------------ | ------------- | --------------------- | ------------------ |
| `--glow-primary`   | `transparent` | purple-500 at 20%     | `bg-purple-500/20` |
| `--glow-secondary` | `transparent` | blue-500 at 15%       | `bg-blue-500/15`   |
| `--glow-tertiary`  | `transparent` | indigo-400 at 10%     | `bg-indigo-400/10` |
| `--star`           | `transparent` | white, `oklch(1 0 0)` | white dots         |

Dark `oklch` values are copied from `node_modules/tailwindcss/theme.css`, with the opacity written into the value, following the `tokens.md` convention.

`@utility bg-starfield` reproduces `Welcome.astro:15`:

- three `radial-gradient(circle, <star at 15%/10%/7%> 1px, transparent 1px)` layers, each opacity applied with `color-mix(in oklab, var(--star) N%, transparent)`;
- sizes `200px 200px, 150px 150px, 100px 100px`;
- positions `0 0, 40px 60px, 80px 30px`.

Blur values go in a plain `@theme` block, giving the classes `blur-glow-sm`, `blur-glow` and `blur-glow-lg`:

- `--blur-glow-sm: 100px`
- `--blur-glow: 120px`
- `--blur-glow-lg: 140px`

#### 2. Landing view

**File**: `src/components/Welcome.astro`, `src/layouts/Layout.astro`

**Intent**:

- **Wrapper:** remove the pin and its comment.
- **Orbs:** keep the same positions; use `bg-glow-*` and `blur-glow*`, with `size-87.5`, `size-62.5` and `size-75` in place of the arbitrary sizes.
- **Star field:** the inline `style` becomes `bg-starfield`.
- **Heading:** the `h1` uses `text-heading` and keeps its sizes.
- **Hero paragraph:** uses `text-muted-foreground`.
- **CTAs:** become `Button asChild size="lg"`, default variant for sign in and `outline` for sign up.
- **Feature cards:** become `Card` with `gap-0 p-6 backdrop-blur-xl dark:shadow-none`. Icons use `text-link`, titles `text-card-foreground` and descriptions `text-muted-foreground`.
- **Card icons:** the three inline SVGs are replaced to match the new card meanings: a list for card 1, layers for card 2 (the current layers icon) and a lock for card 3 (the current lock icon).
- **Page title:** the `Layout` default `title` becomes "SubTracker".

**Contract**: The copy is exactly:

- **Page title:** "SubTracker"
- **`h1`:** "SubTracker"
- **Hero:** "See every subscription you pay for, monthly and yearly, in one list, before the next renewal slips past."
- **CTAs:** "Sign in" → `/auth/signin`; "Create account" → `/auth/signup`
- **Card 1:** "All in one list", "Add each subscription with its amount, currency and billing cycle, and see them together."
- **Card 2:** "Grouped by category", "Pick a starter category or create your own, so duplicates are easier to spot."
- **Card 3:** "Private to you", "Your subscriptions are visible only to your account."

The user may adjust the wording at this phase's manual check. `Welcome.astro` and `src/pages/index.astro` are added to `SCOPE`. No `dark:` class is used for the decoration.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` passes with `Welcome.astro` and `index.astro` in `SCOPE`
- `npm run lint`, `npx astro check` and `npm run build` pass
- No `style=`, `rgba(` or "Pinned dark" remains in `Welcome.astro`, and no `dark bg-cosmic` remains anywhere in `src/` (`grep`)
- Local `npm run smoke` passes (all steps) (`home renders`)

#### Manual Verification:

- In dark, the landing page matches the baseline (orbs, stars, layout) except for listed deltas and the agreed copy
- In light, the landing page shows no orbs or stars, the hero and cards are readable, and both CTAs are clearly buttons, at desktop and 375 px
- The landing wording is approved, or the user's adjustments are applied
- The theme toggle visibly changes all five migrated pages
- Screenshots saved: `landing-{light,dark}-{desktop,375}.png`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: States, visual gate and rule

### Overview

Show the new building blocks in every state on the kitchen sink, complete the screenshot gate, record the dark deltas, and update the agent rule so the next agent keeps the contract.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/dev/kitchen-sink.astro`

**Intent**: Add the building blocks this change introduced to both columns, labelled with `StateLabel` like the existing blocks:

- an auth panel (`Card` with `panelClass`, a `text-heading` title, muted text and a `text-link` link);
- `PasswordToggle` (hover and focus-visible by interaction);
- `Button` in `outline` and `size="lg"` (default, plus disabled);
- `Button asChild` wrapping a link;
- a landing feature `Card`.

The header comment is updated to say the page covers the whole app, not only `/subscriptions`.

**Contract**: Fixture data only; production still returns 404.

#### 2. Screenshots and state matrix

**File**: `context/changes/ui-theme-other-pages/screenshots/` (new), with `README.md`

**Intent**: Store the baseline and the evidence for the gate, and map each of the 7 states to a file or block, or to N/A with a reason, in the format of the archived UI-01 `screenshots/README.md`.

**Contract**:

- `baseline/` (taken before Phase 1);
- the per-page files from Phases 1–3;
- `kitchen-sink-{desktop,375}.png`, taken with the global theme set to light;
- `focus-visible-{light,dark}.png`: crops of an auth link, `PasswordToggle`, the dashboard buttons and a landing CTA;
- `hover.png`.

The README also records the contrast check, along with any light-value adjustment (mirrored in `tokens.md`).

#### 3. Token record

**File**: `context/foundation/tokens.md`

**Intent**: Record the four decoration tokens and the blur values with their sources. Add the dark differences found in Phases 1–3 as "Accepted visual deltas" 17 onwards, under a heading dated with the user's acceptance. Expected entries:

- **Auth pages:** secondary text, hint and confirm-email text move from `blue-100/50`, `/60` and `/80` to `muted-foreground` (blue-100/70).
- **Eye icon:** `white/40` (hover `white/70`) → `muted-foreground` (hover `foreground`), plus the focus ring.
- **Dashboard Sign out:** `Button variant="outline"` (`rounded-md`, `h-9`, `input` tints) replaces the hand-rolled `rounded-lg` `white/10` button.
- **Landing heading:** loses the pink-200 end.
- **Landing CTAs:**
  - `Button` `size="lg"` (`h-10`, `rounded-md`) replaces `py-3 rounded-lg`;
  - the primary hover is `primary/90`;
  - the outline hover uses the `input` tint.
- **Feature cards:** `bg-card` (white/10) replaces `white/5`, and descriptions use `muted-foreground` in place of `blue-100/60`.

Anything else found during the manual checks is listed or fixed.

**Contract**: The rule "anything not listed is drift" still holds.

#### 4. Agent rule

**File**: `AGENTS.md`

**Intent**: Remove the "Pinned dark" bullet from `## UI`. Add `glow-primary`, `glow-secondary`, `glow-tertiary` and `star` to the role-token list, noting that they are decoration tokens transparent in light. Add `bg-starfield` and `blur-glow*` to the utilities. Mention `panelClass` (`src/lib/styles.ts`) as the shared glass-panel class to use before writing a new one.

**Contract**: Edits stay outside the 10x-cli-managed block in `CLAUDE.md` (`AGENTS.md` itself has no such block).

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui`, `npm run lint`, `npx astro check`, `npm run build` and `npm run test:smoke` pass
- The production build still returns 404 for `/dev/kitchen-sink`, checked with `npm run preview` + `curl` after the server check
- `AGENTS.md` contains no "Pinned dark" (`grep`)

#### Manual Verification:

- 7-state matrix complete in both themes for the new blocks: each state shown on the kitchen sink, or marked N/A with a reason in `screenshots/README.md`
- Contrast check in both themes on all five pages and the kitchen sink, with any light-value adjustment recorded
- Every screenshot listed in Changes Required item 2 is present in `screenshots/`
- `tokens.md` lists every dark difference seen against the baseline, and the user accepts the list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new matcher logic. `npm run test:smoke` guards the `lint:ui` matcher and must stay green.

### Integration Tests:

- Local `npm run smoke` after every phase covers `/`, the three auth flows, `/dashboard` and sign-out, and it confirms that markup changes did not break forms or redirects.
- The `lint:ui` scope growing from 13 to 22 files is itself the regression guard: any literal reintroduced later fails pre-commit and CI.

### Manual Testing Steps:

1. Before Phase 1, with a browser tool available and after the server check, capture the dark baseline of the five pages at desktop and 375 px.
2. After each page phase, compare dark against the baseline, check light, Tab through the controls, and save the phase's screenshots.
3. At Phase 3, read the landing copy on the real page and approve or adjust it.
4. At Phase 4, walk the kitchen sink in both columns (hover and Tab), run the contrast check, and accept the delta list.

## Performance Considerations

None material. The star field moves from an inline style to a utility with the same gradients, and the orbs keep their blur radii.

## Migration Notes

No data or schema changes. Deploy through the usual release runbook (`context/plans/deployment-plan.md`); rollback is `npx wrangler rollback`. Build the release from current `master` after merge, one release at a time with `edit-subscription`, so a promotion never drops the other change's merged work; number the runbook Pass after the last one on `master` at release time.

## References

- Change note: `context/changes/ui-theme-other-pages/change.md`
- Previous change (pattern, deltas, gate format): `context/archive/2026-10-06-ui-tokens-onboarding/plan.md`, `…/screenshots/README.md`
- Token source of truth: `context/foundation/tokens.md`
- Pattern view: `src/pages/subscriptions.astro:28-67`
- UI contract: `.claude/skills/10x-ui/SKILL.md`, `AGENTS.md` `## UI`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth pages

#### Automated

- [ ] 1.1 `npm run lint:ui` passes with the six new `SCOPE` entries
- [ ] 1.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 1.3 No `dark bg-cosmic` and no "Pinned dark" in the three auth pages
- [ ] 1.4 Local `npm run smoke` passes (all steps)

#### Manual

- [ ] 1.5 Dark auth pages match the baseline except listed deltas
- [ ] 1.6 Light auth pages read as the same product at desktop and 375 px
- [ ] 1.7 Eye icon visible in both themes with a focus ring on Tab
- [ ] 1.8 `/subscriptions` unchanged after the panel-class extraction
- [ ] 1.9 Auth page screenshots saved

### Phase 2: Dashboard

#### Automated

- [ ] 2.1 `npm run lint:ui` passes with `dashboard.astro` in `SCOPE`
- [ ] 2.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 2.3 Local `npm run smoke` passes (all steps)

#### Manual

- [ ] 2.4 Dark dashboard matches the baseline except listed deltas and agreed copy
- [ ] 2.5 Light dashboard readable at desktop and 375 px
- [ ] 2.6 "Go to subscriptions" and Sign out work, with a focus ring on Tab
- [ ] 2.7 Dashboard screenshots saved

### Phase 3: Landing page

#### Automated

- [ ] 3.1 `npm run lint:ui` passes with `Welcome.astro` and `index.astro` in `SCOPE`
- [ ] 3.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 3.3 No `style=`, `rgba(` or "Pinned dark" in `Welcome.astro`; no `dark bg-cosmic` in `src/`
- [ ] 3.4 Local `npm run smoke` passes (all steps)

#### Manual

- [ ] 3.5 Dark landing matches the baseline except listed deltas and agreed copy
- [ ] 3.6 Light landing has no decoration and is readable at desktop and 375 px
- [ ] 3.7 Landing wording approved or adjusted
- [ ] 3.8 Theme toggle visibly changes all five pages
- [ ] 3.9 Landing screenshots saved

### Phase 4: States, visual gate and rule

#### Automated

- [ ] 4.1 `npm run lint:ui`, `npm run lint`, `npx astro check`, `npm run build` and `npm run test:smoke` pass
- [ ] 4.2 Production build returns 404 for `/dev/kitchen-sink`
- [ ] 4.3 No "Pinned dark" in `AGENTS.md`

#### Manual

- [ ] 4.4 7-state matrix complete in both themes for the new blocks
- [ ] 4.5 Contrast check in both themes on all five pages and the kitchen sink
- [ ] 4.6 All listed screenshots present in `screenshots/`
- [ ] 4.7 `tokens.md` delta list complete and accepted
