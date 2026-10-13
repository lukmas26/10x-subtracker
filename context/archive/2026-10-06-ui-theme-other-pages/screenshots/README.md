# Screenshots — ui-theme-other-pages (Phase 4 visual gate)

Evidence for the gate. The kitchen sink is `src/pages/dev/kitchen-sink.astro` (dev server only; the production build returns 404). It renders a light column and a dark column (`class="dark"`) side by side, each in `bg-cosmic`; the columns stack below the `md` breakpoint, so at 375 px light comes first, dark below it.

Note: the light column is only light while the page itself is light. Take the kitchen-sink shots with the global theme set to light.

## Files

Implementation ran without a browser tool, and the user does all manual checks at the end. The dark baseline was **not** taken before Phase 1; it was captured on 2026-10-13 by the user from the pre-change commit `187299d` (a throwaway worktree served on port 4330). Desktop shots are viewport captures (`signup`, `dashboard`) or 1920 px browser-window captures with the browser UI visible (`landing`, `signin`, `confirm-email`); none is full page. The 375 px shots are DevTools device-mode captures. The dashboard was signed in as a throwaway account (`test@email.com`); forms are empty. The user decided on 2026-10-13 not to capture the post-change screenshots; the states were checked live on the dev server instead (plan checks 4.4 and 4.5). Plan checks 1.9, 2.7, 3.9 and 4.6 therefore stay open.

| File                                                | What it shows                                                                         | Status     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| `baseline/<page>-dark-{desktop,375}.png`            | `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/dashboard` at `187299d` | captured   |
| `signin-{light,dark}-{desktop,375}.png`             | `/auth/signin`                                                                        | to capture |
| `signup-{light,dark}-{desktop,375}.png`             | `/auth/signup`                                                                        | to capture |
| `confirm-email-{light,dark}-{desktop,375}.png`      | `/auth/confirm-email` (dev variant)                                                   | to capture |
| `dashboard-{light,dark}-{desktop,375}.png`          | `/dashboard`, signed in                                                               | to capture |
| `landing-{light,dark}-{desktop,375}.png`            | `/`                                                                                   | to capture |
| `kitchen-sink-desktop.png`, `kitchen-sink-375.png`  | Kitchen sink, global theme light (full page)                                          | to capture |
| `focus-visible-light.png`, `focus-visible-dark.png` | Crops: an auth link, `PasswordToggle`, the dashboard buttons and a landing CTA        | to capture |
| `hover.png`                                         | Crop: hover on the same targets                                                       | to capture |

## 7-state matrix (new blocks)

Kitchen-sink block names are the state labels printed on the page.

| State         | Light                                                                                                                                                                                                               | Dark                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| default       | Checked live on the kitchen sink (plan check 4.4): "Auth panel", "PasswordToggle — default", "Button — default, outline, size lg, disabled; link styled as a button", "Landing feature card"; and on the five pages | same blocks in the dark column |
| hover         | Checked live (plan check 4.4): the auth link, `PasswordToggle`, buttons, button links                                                                                                                               | same, on the dark column       |
| focus-visible | Checked live with Tab (plan checks 1.7, 2.6, 4.4)                                                                                                                                                                   | same, in dark                  |
| disabled      | Checked live on the kitchen sink (plan check 4.4): the two disabled `Button`s. `PasswordToggle` and links: **N/A**, they are never disabled                                                                         | same blocks in the dark column |
| error         | **N/A** for the new blocks: none of them shows an error. Form errors are the existing "FormField — error" / "ServerError" blocks                                                                                    | N/A (same reason)              |
| empty         | **N/A**: the new blocks are static content with no list or data                                                                                                                                                     | N/A (same reason)              |
| loading       | **N/A**: the new blocks are static links and buttons; the submit pending state is the existing "SubmitButton — pending (loading)" block                                                                             | N/A (same reason)              |

## Contrast check

Done by the user on 2026-10-13, in both themes on all five pages and the kitchen sink: body text, muted text, link, the eye icon, both button variants and the focus ring. Result: OK.

Light-value adjustments made after the check: none. Any adjustment is recorded here and mirrored in `../../../foundation/tokens.md`.
