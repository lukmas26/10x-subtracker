# Screenshots — ui-tokens-onboarding (Phase 5 visual gate)

Evidence for the Phase 5 gate. The kitchen sink is `src/pages/dev/kitchen-sink.astro` (dev server only; the production build returns 404). It renders a light column and a dark column (`class="dark"`) side by side, each in `bg-cosmic`; the columns stack below the `md` breakpoint, so at 375 px light comes first, dark below it.

Note: the light column is only light while the page itself is light. If the global theme is dark (`<html class="dark">`), both columns render dark — take the kitchen-sink shots with the global theme set to light.

## Files

**Not captured yet (2026-10-07).** The 7-state matrix and the contrast check were verified by hand, but no PNGs were saved: Claude in Chrome was not available to the session and the user chose to continue without them. Plan check 5.5 stays open until these files are added.

| File                              | What it shows                                                                                                   | Status     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| `kitchen-sink-desktop.png`        | Kitchen sink at desktop width, both columns side by side (full page)                                            | to capture |
| `kitchen-sink-375.png`            | Kitchen sink at 375 px, columns stacked (full page)                                                             | to capture |
| `subscriptions-light-desktop.png` | `/subscriptions` in light at desktop width                                                                      | to capture |
| `subscriptions-light-375.png`     | `/subscriptions` in light at 375 px                                                                             | to capture |
| `subscriptions-dark-desktop.png`  | `/subscriptions` in dark at desktop width                                                                       | to capture |
| `subscriptions-dark-375.png`      | `/subscriptions` in dark at 375 px                                                                              | to capture |
| `focus-visible-light.png`         | Crop: keyboard focus (Tab) on a field, the submit button, a Topbar link and the ThemeToggle in the light column | to capture |
| `focus-visible-dark.png`          | Crop: the same focus-visible targets in the dark column                                                         | to capture |
| `hover.png`                       | Crop: hover on the submit button, a Topbar link and the ThemeToggle                                             | to capture |

## 7-state matrix

Kitchen-sink block names are the state labels printed on the page.

| State         | Light                                                                                                                                                                                | Dark                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| default       | `kitchen-sink-*`: "FormField — default", "SelectField — default", "SubmitButton — default", "ThemeToggle — default", Topbar, "Alert" (default), "Card"; also `subscriptions-light-*` | same blocks in the dark column; `subscriptions-dark-*`                                               |
| hover         | `hover.png` (interaction on the light column)                                                                                                                                        | `hover.png` if captured on the dark column too; otherwise interact on the dark column and add a crop |
| focus-visible | `focus-visible-light.png`                                                                                                                                                            | `focus-visible-dark.png`                                                                             |
| disabled      | `kitchen-sink-*`: "FormField — disabled", "SelectField — disabled", "SubmitButton — disabled"                                                                                        | same blocks in the dark column                                                                       |
| error         | `kitchen-sink-*`: "FormField — error", "SelectField — error", "ServerError", "Alert" (destructive)                                                                                   | same blocks in the dark column                                                                       |
| empty         | `kitchen-sink-*`: "List — empty"                                                                                                                                                     | same block in the dark column                                                                        |
| loading       | `kitchen-sink-*`: "SubmitButton — pending (loading)". List-loading skeleton: **N/A** — the list is server-rendered, so it never shows a loading state in the browser                 | same block in the dark column; skeleton N/A (same reason)                                            |

Success feedback (not one of the 7 states, but covered): "Alert" (success) in both columns.

## Contrast check

Checked manually by the user on 2026-10-07 on `/dev/kitchen-sink` and `/subscriptions` in both themes: body text, muted text, link, destructive and success text, and the focus ring are all legible. Nothing flagged.

Light-value adjustments made after the check: none. Any adjustment is recorded here and mirrored in `../tokens.md`.
