# Theme the remaining pages (auth, dashboard, landing) — Plan Brief

> Full plan: `context/changes/ui-theme-other-pages/plan.md`

## What & Why

UI-01 gave the app a light and a dark theme and moved `/subscriptions` onto design tokens. Five views were left pinned dark with hand-written colours: sign in, sign up, confirm email, dashboard and the landing page. On those pages the theme toggle appears to do nothing (UI-01 review F6). This change moves them onto the same tokens and components, so the whole app follows the toggle and `lint:ui` keeps every view clean. It also replaces the starter copy on the landing page and the dashboard with copy for SubTracker.

## Starting Point

Each of the five views wraps itself in `class="dark …"` and uses 1–40 literal colours or sizes (75 in total, 40 of them on the landing page). `/subscriptions` already shows the target shape (`Card`, `text-heading`, `text-muted-foreground`, `text-link`), and every needed component exists in `src/components/ui/`. The landing page still says "10x Astro Starter", and the dashboard has no way to reach `/subscriptions`.

## Desired End State

All five pages render correctly in light and dark from tokens and shared components alone, with no pins. Dark looks as it does today, except for listed, accepted differences and the new copy. The landing page's orbs and stars stay in dark and disappear in light, driven by tokens alone. The dashboard links to `/subscriptions`. `lint:ui` covers 22 files, and `AGENTS.md` no longer mentions pinned pages.

## Key Decisions Made

| Decision            | Choice                                                                                                                                            | Why (1 sentence)                                                                     | Source |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| Landing decoration  | Dark-only, through tokens that are `transparent` in light                                                                                         | Dark looks as it does today, and no light decoration needs designing.                | Plan   |
| Landing heading     | Shared two-stop `text-heading`; the pink end is dropped                                                                                           | One heading style app-wide, with no new tokens.                                      | Plan   |
| Change boundary     | One change: auth → dashboard → landing, then states and rule                                                                                      | All pins and F6 close in one PR, so the toggle is never half-broken.                 | Plan   |
| Screenshot gate     | The user enables a browser tool, and the agent captures the screenshots, including a dark baseline first                                          | The gate closes, unlike UI-01's open check 5.5.                                      | Plan   |
| Copy                | Rewrite the landing page, the dashboard and the default title for SubTracker, using the agreed draft; the user can adjust it at the Phase 3 check | The first screen describes the real product, and it claims only features that exist. | Plan   |
| Panel style         | Extract the `/subscriptions` panel class into `src/lib/styles.ts` (`panelClass`)                                                                  | It would otherwise be copied a 4th and 5th time.                                     | Plan   |
| Orb sizes and blurs | `size-87.5`, `size-75` and `size-62.5`, plus named `blur-glow*` values                                                                            | Dark stays pixel-identical without arbitrary values.                                 | Plan   |

## Scope

**In scope:**

- the three auth pages, plus `PasswordToggle` and the sign-up hint;
- the dashboard, with a "Go to subscriptions" button;
- the landing page: decoration tokens, CTAs, cards and copy;
- the `Layout` default title;
- the shared `panelClass`;
- kitchen-sink states, screenshots, `tokens.md` deltas and the `AGENTS.md` rule.

**Out of scope:**

- landing decoration in light;
- a three-stop gradient;
- new components or dependencies;
- auth page wording;
- Polish copy;
- a `Topbar` on these pages;
- routing, auth or smoke changes;
- UI-01's check 5.5;
- Playwright.

## Architecture / Approach

Dark mode stays at the token layer. Pages use role classes only, and the `.dark` values in `global.css` carry today's look. The decoration uses four new colour tokens (`--glow-primary`, `--glow-secondary`, `--glow-tertiary`, `--star`) whose light value is `transparent`, a `bg-starfield` utility, and named blur values. Each page phase removes its pin, replaces its literals and adds its files to `SCOPE`, so no page is ever half-migrated.

## Phases at a Glance

| Phase                 | What it delivers                                                                 | Key risk                                        |
| --------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1. Auth pages         | Sign in, sign up and confirm email on `Card` and tokens; the shared `panelClass` | The extraction must not change `/subscriptions` |
| 2. Dashboard          | `Card`, outline Sign out, "Go to subscriptions", new copy                        | Sign-out flow (covered by smoke)                |
| 3. Landing page       | Decoration tokens, `Button asChild` CTAs, `Card` features, SubTracker copy       | Dark decoration drifting from the baseline      |
| 4. States, gate, rule | Kitchen-sink states, screenshot set, delta list, `AGENTS.md` update              | Delta list incomplete against the baseline      |

**Prerequisites:**

- a browser tool is enabled (Claude in Chrome or the desktop browser pane);
- a dark baseline of the five pages is captured before Phase 1;
- local Supabase is running for smoke;
- no other dev server is on :4321, or the user has said what to do with it.

**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- If the browser tool is unavailable at implementation time, the gate (and the baseline) blocks Phase 1. The implementer stops and asks rather than skipping.
- The draft landing copy may change at the Phase 3 check; that is a small follow-up within the phase.
- In light, the auth pages and dashboard get the same white-card look as `/subscriptions`, whose light values passed the UI-01 contrast check. That check is repeated in Phase 4.

## Success Criteria (Summary)

- The toggle visibly switches every page in the app between light and dark.
- In dark, the pages look as they do today, apart from the accepted differences; in light they read as the same product.
- The landing page and dashboard describe SubTracker, and the dashboard leads to the subscription list.
