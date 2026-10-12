# Token values — ui-tokens-onboarding

Source of truth for the colour tokens in `src/styles/global.css` (`:root` = light, the default; `.dark` = today's cosmic look). Every token is published in `@theme inline` as `--color-<name>`, so it is used as `bg-<name>`, `text-<name>`, `border-<name>`, etc.

`oklch` values are copied from `node_modules/tailwindcss/theme.css` (Tailwind 4.2). White is written `oklch(1 0 0)`, as shadcn does. Opacity is part of the token value (`oklch(... / N%)`), not a class modifier. The two cosmic hexes stay hex because they are not Tailwind palette colours.

Light values are starting values; Phase 5's contrast check may adjust them, and this file then records the final ones.

## Reassigned shadcn tokens

| Token                  | Light (`:root`)                         | Dark (`.dark`)                                     | Source (dark literal it replaces)                                                                                                    |
| ---------------------- | --------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `--background`         | slate-50 `oklch(98.4% 0.003 247.858)`   | `#0a0e1a`                                          | old `bg-cosmic` hex, `global.css:116` (pre-change)                                                                                   |
| `--foreground`         | slate-900 `oklch(20.8% 0.042 265.755)`  | white `oklch(1 0 0)`                               | `text-white`, `subscriptions.astro:32,47`                                                                                            |
| `--card`               | white `oklch(1 0 0)`                    | white/10 `oklch(1 0 0 / 10%)`                      | `bg-white/10` glass panel, `subscriptions.astro:32,47`                                                                               |
| `--card-foreground`    | slate-900                               | white                                              | `text-white`, `subscriptions.astro:32,47`                                                                                            |
| `--popover`            | white                                   | `#0a0e1a` (cosmic base)                            | `[&>option]:bg-slate-900` workaround, `SelectField.tsx:35`                                                                           |
| `--popover-foreground` | slate-900                               | white                                              | option text, `SelectField.tsx:35`                                                                                                    |
| `--primary`            | purple-600 `oklch(55.8% 0.288 302.321)` | purple-600 `oklch(55.8% 0.288 302.321)`            | `bg-purple-600`, `SubmitButton.tsx:18`                                                                                               |
| `--primary-foreground` | white                                   | white                                              | `text-white`, `SubmitButton.tsx:18`                                                                                                  |
| `--muted-foreground`   | slate-600 `oklch(44.6% 0.043 257.281)`  | blue-100 at 70% `oklch(93.2% 0.032 255.585 / 70%)` | `text-blue-100/70`, `subscriptions.astro:58`, `Topbar.astro:8,25`                                                                    |
| `--border`             | slate-200 `oklch(92.9% 0.013 255.508)`  | white/10 `oklch(1 0 0 / 10%)`                      | `border-white/10`, `subscriptions.astro:32,47`; `divide-white/10`, `:54`                                                             |
| `--input`              | slate-300 `oklch(86.9% 0.022 252.894)`  | white/20 `oklch(1 0 0 / 20%)`                      | `border-white/20`, `FormField.tsx:56`, `SelectField.tsx:36`                                                                          |
| `--ring`               | purple-500 `oklch(62.7% 0.265 303.9)`   | purple-400 `oklch(71.4% 0.203 305.504)`            | `focus:ring-purple-400`, `FormField.tsx:56`, `SelectField.tsx:36`                                                                    |
| `--destructive`        | red-600 `oklch(57.7% 0.245 27.325)`     | red-400 `oklch(70.4% 0.191 22.216)`                | `red-300/400` error text and borders, `FormField.tsx:56,62`, `SelectField.tsx:36,43`, `ServerError.tsx:11`, `subscriptions.astro:50` |

Unchanged shadcn neutral values: `--secondary*`, `--muted`, `--accent*`, `--chart-*`, `--sidebar-*`.

## New role tokens

| Token                    | Light (`:root`)                         | Dark (`.dark`)                          | Source (dark literal it replaces)                                          |
| ------------------------ | --------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `--background-highlight` | white `oklch(1 0 0)`                    | `#0f1529`                               | old `bg-cosmic` middle hex, `global.css:116` (pre-change)                  |
| `--success`              | green-700 `oklch(52.7% 0.154 150.069)`  | green-300 `oklch(87.1% 0.15 154.449)`   | `text-green-300`, `subscriptions.astro:39`                                 |
| `--link`                 | purple-700 `oklch(49.6% 0.265 301.924)` | purple-300 `oklch(82.7% 0.119 306.383)` | `text-purple-300`, `Topbar.astro:10,13,17,27,30` (+ 6 more on other pages) |
| `--heading-from`         | blue-700 `oklch(48.8% 0.243 264.376)`   | blue-200 `oklch(88.2% 0.059 254.128)`   | `from-blue-200`, `subscriptions.astro:33`                                  |
| `--heading-to`           | purple-700 `oklch(49.6% 0.265 301.924)` | purple-200 `oklch(90.2% 0.063 306.703)` | `to-purple-200`, `subscriptions.astro:33`                                  |

## Decoration tokens (ui-theme-other-pages)

Dark-only landing decoration. The light value is `transparent`, so the orbs and stars disappear in light at the token layer, with no `dark:` class in the markup.

| Token              | Light (`:root`) | Dark (`.dark`)                                             | Source (dark literal it replaces)                           |
| ------------------ | --------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `--glow-primary`   | `transparent`   | purple-500 at 20% `oklch(62.7% 0.265 303.9 / 20%)`         | `bg-purple-500/20`, `Welcome.astro:8` (pre-change)          |
| `--glow-secondary` | `transparent`   | blue-500 at 15% `oklch(62.3% 0.214 259.815 / 15%)`         | `bg-blue-500/15`, `Welcome.astro:9` (pre-change)            |
| `--glow-tertiary`  | `transparent`   | indigo-400 at 10% `oklch(67.3% 0.182 276.935 / 10%)`       | `bg-indigo-400/10`, `Welcome.astro:10` (pre-change)         |
| `--star`           | `transparent`   | white `oklch(1 0 0)` (layer opacity set by `bg-starfield`) | `rgba(255,255,255,…)` dots, `Welcome.astro:15` (pre-change) |

Blur values (plain `@theme`, not colours): `--blur-glow-sm: 100px`, `--blur-glow: 120px`, `--blur-glow-lg: 140px` → `blur-glow-sm`, `blur-glow`, `blur-glow-lg`; they replace `blur-[100px]`, `blur-[120px]`, `blur-[140px]` (`Welcome.astro:8-10`, pre-change).

## Utilities

- `bg-cosmic` — `linear-gradient(to bottom, var(--background), var(--background-highlight), var(--background))`. In dark this is exactly the old `#0a0e1a → #0f1529 → #0a0e1a`; in light a subtle slate-50 → white → slate-50.
- `bg-starfield` — three `radial-gradient` dot layers from `--star` at 15% / 10% / 7% (`color-mix(in oklab, …)`), sizes `200px / 150px / 100px`, positions `0 0 / 40px 60px / 80px 30px`. Reproduces the inline style of `Welcome.astro:15` (pre-change); transparent in light.
- `text-heading` — `linear-gradient(to right in oklab, var(--heading-from), var(--heading-to))` with `background-clip: text` and `color: transparent`. Replaces `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent` (`subscriptions.astro:33` and 5 more); `in oklab` matches Tailwind 4's gradient interpolation.

## Accepted visual deltas (dark theme only)

The light theme is new, so it has no baseline. In dark, only these differ from the pre-change look; anything else is drift.

1. Primary-button hover: `bg-primary/90` instead of `hover:bg-purple-500` (`SubmitButton.tsx:18`).
2. Error text: `text-destructive` (red-400) instead of `text-red-300` (`FormField.tsx:62`, `SelectField.tsx:43`, `ServerError.tsx:11`, `subscriptions.astro:50`).
3. Topbar link hover: `hover:text-foreground` (white) instead of `hover:text-purple-100` (`Topbar.astro:10,13,17,27,30`).
4. shadcn `Card`/`Alert` internal spacing replaces hand-rolled paddings where the difference is ≤ 4px.

Added in Phase 3 (accepted by the user on 2026-10-07):

5. Input/select focus: shared `focus-visible:ring-ring/50` (3px, purple-400 at 50%) plus `border-ring`, instead of a solid `ring-2 purple-400`; same ring as buttons and the theme toggle.
6. Invalid fields: border/ring from shadcn `aria-invalid:*destructive*` instead of `red-400/60`.
7. Placeholders and field icons: `text-muted-foreground` (blue-100/70) instead of `white/40`; labels `text-muted-foreground` instead of `blue-100/80`.
8. Topbar: `bg-card` (white/10) instead of `white/5`; text `text-muted-foreground` instead of `white/80`.
9. Submit button radius: `Button` default `rounded-md` (8px) instead of `rounded-lg` (10px); inputs keep `rounded-lg`.
10. Alerts: `destructive/10` and `success/10` tints with `/30` borders instead of `red-900/30` and `green-900/30`.

Added in Phase 4 (accepted by the user on 2026-10-07):

11. `/subscriptions` h2 "Your subscriptions": `text-card-foreground` (white) instead of `text-blue-100`.
12. Empty-state text: `text-muted-foreground` (blue-100/70) instead of `text-blue-100/60`.
13. Saved/load-error alert text: the `Alert` variant's `text-success/90` / `text-destructive/90` instead of full-strength `text-green-300` / `text-red-300`.

Token-driven side effects of Phase 2 (accepted by the user on 2026-10-08, impl-review F5):

14. `Button` focus ring (`ring-ring/50`) is purple-400 at 50% instead of grey (C2's intent).
15. `body` outside the `bg-cosmic` wrapper is `#0a0e1a` instead of `oklch(0.145 0 0)`.
16. `ThemeToggle` outline border is white/20 instead of white/15.

Added by ui-theme-other-pages (**pending the user's acceptance** at the final manual check; date the heading when accepted):

17. Auth pages: secondary text, the sign-up password hint and the confirm-email description use `text-muted-foreground` (blue-100/70) instead of `blue-100/60`, `/50` and `/80`; dashboard secondary text likewise instead of `blue-100/80` and `/50`.
18. Password eye icon: `text-muted-foreground` (hover `text-foreground`) instead of `white/40` (hover `white/70`), plus the shared `focus-visible:ring-3 ring-ring/50` focus ring.
19. Auth and dashboard panels: shadcn `Card` (`bg-card`, `border`) with `panelClass`, padding kept at `p-8`; the auth links get the Topbar focus ring.
20. Dashboard Sign out: `Button variant="outline"` (`rounded-md`, `h-9`, `input` tints) instead of the hand-rolled `rounded-lg` `white/10` button; new primary "Go to subscriptions" button and SubTracker copy.
21. Landing heading: two-stop `text-heading` (blue-200 → purple-200), losing the pink-200 end.
22. Landing CTAs: `buttonVariants({ size: "lg" })` (`h-10`, `rounded-md`, `text-sm`) instead of `py-3 rounded-lg text-base`; primary hover `primary/90` instead of `purple-500`; outline hover uses the `input` tint.
23. Landing feature cards: `bg-card` (white/10) instead of `white/5`; descriptions `text-muted-foreground` (blue-100/70) instead of `blue-100/60`; new lucide icons (list, layers, lock) and SubTracker copy.

## Known gap — closed in Phase 4

From Phase 2 until Phase 4, `/subscriptions` was **unreadable in light** (the default): its unpinned `bg-cosmic` wrapper rendered slate-50 → white while the page still used literal `text-white`, `bg-white/10`, `border-white/10`, `text-blue-100/70` and the `from-blue-200 to-purple-200` heading (accepted by the user on 2026-10-07). **Closed in Phase 4:** the page now renders its sections as `Card`, its messages as `Alert`, and its text from tokens, and the `KNOWN GAP` comment in `src/pages/subscriptions.astro` was removed.
