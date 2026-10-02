# Safe Release Verification — Plan Brief

> Full plan: `context/changes/safe-release-verification/plan.md`

## What & Why

Roadmap F-01. Preview URLs of the `subtracker` Worker are public and, since Supabase was wired on 2026-09-26, reach the production database — S-01's first preview would expose real amounts. The smoke test also reports success where sign-in actually failed (prefix-matched redirects) and cannot run end-to-end against hosted Supabase. Both must be fixed before S-01 is promoted.

## Starting Point

Releases already go `versions upload` → verify preview → human approves → `versions deploy`. `scripts/smoke.mjs` runs 8 steps with a fresh `@example.com` sign-up and `startsWith` location checks; CI runs it against a local Supabase (8/8). Against hosted Supabase it gets 6/8 because the address is rejected and email confirmation is required.

## Desired End State

Preview URLs show a Cloudflare Access login to anyone without identity; production is unchanged. The smoke test fails on any wrong redirect path or unexpected `?error=`. A `npm run smoke:remote` run with a pre-confirmed test account proves sign-in → dashboard → sign-out against hosted Supabase on an Access-protected preview (plus an explicit "anonymous is blocked" check) and on production, following a documented release runbook.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Preview protection | Cloudflare Access on preview URLs + service token | Keeps the version-based gate and identical secrets from preview to production | Plan (matches infrastructure.md) |
| Hosted auth proof | Remote mode signs in with a pre-confirmed account | Repeatable per release, no inbox clicks or mailer rate limits | Plan |
| Sign-up on production | Never in the smoke; proven once manually when creating the test account | Writes no test users to production; local/CI still covers sign-up every run | Plan |
| Where remote smoke runs | Locally from a runbook, creds in gitignored `.env.smoke` | Matches the human-gated flow; no new CI secrets | Plan |
| Redirect assertion | Exact pathname, same origin, error param required/forbidden | Removes the Pass 1 false-pass class, pinned by `node:test` | Plan |
| Protection check | `SMOKE_EXPECT_ACCESS=1` step sends no Access headers/cookies and expects a block | Proves Access is actually on, not just assumed | Plan |

## Scope

**In scope:**
- `scripts/smoke-match.mjs` + `node:test` tests, run in CI
- Remote mode, Access headers, anonymous-blocked check in `scripts/smoke.mjs`
- `.env.smoke.example`, `.gitignore`, `smoke:remote` / `test:smoke` scripts, `AGENTS.md`
- Human setup: Access on previews, service token, confirmed test account
- Release runbook + Pass 3 record in `context/plans/deployment-plan.md`

**Out of scope:**
- Sign-up against production in the smoke; automated test-user cleanup; service-role key
- Separate preview database; disabling preview URLs; Access on production
- CI workflow for remote smoke; scoped API token; GitHub repo secrets; any `src/**` change

## Architecture / Approach

One pure matcher module is the single rule for redirect expectations. `smoke.mjs` picks its step list from the environment: local (8 steps incl. sign-up, used by CI) or remote (7 steps, existing account; +1 anonymous-blocked step when `SMOKE_EXPECT_ACCESS=1`). Access service-token headers are added in the shared `request()` helper. `node --env-file=.env.smoke` loads credentials; `BASE_URL` on the command line overrides the file.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Exact redirect assertions | Matcher + tests in CI; local 8-step flow unchanged | CI smoke exposing a real redirect mismatch that the prefix hid |
| 2. Remote smoke mode | Env-selected remote mode, Access headers, env-file plumbing, docs | Silent fallback to local mode on half-set env (guarded: exit 1) |
| 3. Access setup, runbook, live verification | Protected previews, test account, runbook, recorded live runs | Access config not covering version preview URLs (caught by the anonymous-blocked step) |

**Prerequisites:** Cloudflare dashboard access (Zero Trust enabled, free tier), a real email inbox for the test account, local Node 22 for `--env-file`/`node:test`.
**Estimated effort:** ~2 short sessions across 3 phases; Phase 3 is mostly human dashboard work.

## Open Risks & Assumptions

- Assumes Cloudflare's "Preview URLs → Cloudflare Access" toggle protects per-version preview hostnames; the anonymous-blocked step verifies it rather than trusting it.
- Hosted sign-up is re-proven only when someone signs up manually; a regression in hosted email delivery would not show in the remote smoke.
- Repeated wrong-password attempts per run could hit Supabase auth rate limits if the smoke is run in a tight loop.

## Success Criteria (Summary)

- A preview URL opened anonymously shows the Access login; production is untouched.
- A wrong sign-in redirect makes the smoke test fail, locally and in CI.
- The remote smoke passes on an Access-protected preview and on production against hosted Supabase, as recorded in the runbook.
