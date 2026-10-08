---
change_id: ui-tokens-onboarding
title: Organize CSS styles, theme tokens and UI conventions
status: impl_reviewed
created: 2026-10-06
updated: 2026-10-08
archived_at: null
---

## Notes

orgnize css styles, theme, UI

- Issue: [#12 [UI-01]](https://github.com/lukmas26/10x-subtracker/issues/12)
- Branch: `ui01-tokens-onboarding`

### UI scope (/10x-ui)

- **View:** `/subscriptions` (`src/pages/subscriptions.astro` + `SubscriptionForm` island and the form primitives it uses). One view plus global tokens; other pages only change through shared tokens/components.
- **Token source:** `src/styles/global.css` (`:root` / `.dark` values, published via `@theme inline`); components in `src/components/ui` (shadcn new-york, add via `npx shadcn@latest add <name>`).
- **Contract variant:** fresh starter with a dead token file — shadcn neutral tokens exist, the view reads none of them (pre-audit 2026-10-06: 70 hardcoded-value hits across 9 view files, 0 token classes, 1 `components/ui` import). Phase 1 makes the view read tokens; the existing glass/cosmic look is the motif to map onto the tokens, not to redesign.
- **Themes (decided 2026-10-06):** two themes — light (default, `:root`) and dark (today's cosmic look, `.dark` on `<html>`), switched by a toggle in `Layout`, stored in `localStorage`. The other five `bg-cosmic` pages are pinned dark until follow-up change `ui-theme-other-pages`.
