---
change_id: ui-theme-other-pages
title: Migrate dashboard, auth and landing pages to tokens and both themes
status: new
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Notes

- Issue: [#13 [UI-02]](https://github.com/lukmas26/10x-subtracker/issues/13)

Follow-up to `ui-tokens-onboarding` (issue #12 [UI-01]). That change introduces two themes (light default, dark via `.dark` on `<html>`, toggle in `Layout`, stored in `localStorage`) and moves `/subscriptions` onto tokens + shadcn components. The five pages below still use the hand-written cosmic literals (`bg-white/10`, `text-white`, `text-blue-100/*`, `text-purple-300`, gradient headings) and are **pinned dark** with `class="dark"` on their outermost wrapper as an interim measure.

Pages to migrate (one `/10x-ui` view at a time, or as one change if they share enough):

- `src/pages/auth/signin.astro`
- `src/pages/auth/signup.astro`
- `src/pages/auth/confirm-email.astro`
- `src/pages/dashboard.astro` (hand-rolled outline button → `Button variant="outline"`)
- `src/components/Welcome.astro` (landing `/`; decorative blur orbs, hand-rolled CTA links → `Button asChild`)

While pinned, the `Layout` theme toggle has no visible effect on these pages beyond its own icon and the config banner, so users may read it as broken (ui-tokens-onboarding impl-review F6). Migrating them closes that; if one page is left pinned at the end, hide the toggle there.

Done when: each page reads only tokens and `src/components/ui` components, renders correctly in both themes, its interim `dark` pin is removed, and it is added to the `npm run lint:ui` scope. Use `context/foundation/tokens.md` as the value source.
