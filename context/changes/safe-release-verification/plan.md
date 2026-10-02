# Safe Release Verification Implementation Plan

## Overview

Roadmap item **F-01**: make pre-promotion verification of releases that carry financial data both *safe* and *honest*. Preview URLs stop being publicly readable (Cloudflare Access in front of them), and the smoke test gains exact redirect assertions and a remote mode that proves sign-in → protected page → sign-out against the hosted (production) Supabase through an Access-protected preview. This is the verification path S-01 needs before its first promotion.

## Current State Analysis

- Releases follow the gated flow from `context/plans/deployment-plan.md` Pass 2: `wrangler versions upload` / `versions secret put` → verify the preview URL → human approves → `wrangler versions deploy`. Production runs version `acbce2f0…` with `SUPABASE_URL`/`SUPABASE_KEY` wired to the hosted project.
- **Preview URLs are public** and — since Pass 2 — reach the real production database (`deployment-plan.md:324-325`, `infrastructure.md:204-206`, risk register `infrastructure.md:241`). Secrets are per Worker version, so the previewed version *is* the promoted one: a separate preview database would force a secret change (and a new, unverified version) at every promotion.
- **The smoke test's location check is a prefix match** (`scripts/smoke.mjs:66`, `actual.location.startsWith(expected.location)`). With `expected.location: "/"` (`scripts/smoke.mjs:54`) every relative redirect passes — Pass 1 recorded `signin accepts correct password` passing on `/auth/signin?error=…` (`deployment-plan.md:298-300`). `"/auth/signin?error="` (`:49`) is likewise a prefix, not a check that an error is present.
- **The smoke test cannot run end-to-end against hosted Supabase**: the address is hard-coded to `@example.com` (`scripts/smoke.mjs:5`), which hosted Supabase rejects (Pass 2: 6/8). Hosted projects also require email confirmation before sign-in, while the local stack does not (`supabase/config.toml:209` `enable_confirmations = false`) — which is why CI's local run is 8/8.
- CI's `smoke` job (`.github/workflows/ci.yml:27-55`) runs the smoke test against `npm run preview` + a local Supabase; it must keep working unchanged in behaviour.
- `scripts/**/*.mjs` is linted by a dedicated block in `eslint.config.js` (`scriptsConfig`), so new script files fall under `npm run lint`.
- There is no test runner in the repo; Node 22 (CI, `.nvmrc`) ships `node:test` and `--env-file`, both dependency-free.
- `infrastructure.md` Operational Story: enabling Access, creating service tokens and any production-secret or dashboard action are human-only; the agent may run `wrangler versions upload`, `tail` and read-only commands.

## Desired End State

- Opening any preview URL of the `subtracker` Worker in a browser without Access identity shows the Cloudflare Access login, not the app; the production `*.workers.dev` URL is unchanged.
- `npm run smoke` (local/CI) runs the same 8 steps as today but fails on any redirect whose path differs from the expected one, and on any `?error=` where success is expected (and vice versa).
- `npm run smoke:remote` with a gitignored `.env.smoke` signs in with a pre-confirmed test account against hosted Supabase and passes all steps against (a) an Access-protected preview — including an explicit check that an anonymous request is blocked — and (b) production.
- `context/plans/deployment-plan.md` carries a release runbook that names exactly when and how to run the remote smoke before promotion, and its "Still unverified / Still open" items that F-01 resolves are closed out.

Verify by: `node --test scripts/` green, CI green, and the Phase 3 live runs recorded in the runbook's execution entry.

### Key Discoveries:

- `scripts/smoke.mjs:66` — the prefix match is the single root cause of both weak assertions.
- `scripts/smoke.mjs:23-36` — every request already goes through one `request()` helper; Access headers and the cookie jar (which will also carry `CF_Authorization`) plug in there.
- `.github/workflows/ci.yml:53` — CI calls `npm run smoke` with only `BASE_URL`; with no remote-mode env set, it must fall back to today's local mode.
- `deployment-plan.md:312-314` — POSTs need an `Origin` header or Astro's CSRF check returns 403; the helper already sends it.
- `.gitignore` ignores `.env` and `.env.production` exactly — a new `.env.smoke` is **not** covered today.

## What We're NOT Doing

- **No sign-up against production.** Remote mode never calls `/api/auth/signup`; sign-up stays proven by the local/CI run. Hosted sign-up + email confirmation is proven once, manually, when the test account is created (Phase 3). This deliberately narrows the roadmap wording "full sign-up → sign-in → protected page round trip" to sign-in → protected page → sign-out on hosted.
- No separate preview Supabase project, and no disabling of preview URLs.
- No service-role key anywhere (no automated user cleanup).
- No CI workflow for the remote smoke — it runs locally from the runbook; no new GitHub secrets.
- No app code changes (`src/**` untouched), no schema/migrations, no Access on the production hostname.
- Not in F-01: scoped `CLOUDFLARE_API_TOKEN`, GitHub repo secrets for CI, CI push-to-deploy (remain listed as open in `deployment-plan.md`).
- No promotion to production as part of this change — the app is unchanged, so production is verified as-is.

## Implementation Approach

Fix the assertion first and pin it with unit tests, so everything later is measured with an honest ruler. Then add a remote mode selected purely by environment variables (no flags, no new dependencies), keeping local/CI mode byte-for-byte the same step list. Finally the human performs the dashboard/account setup, and the agent documents the runbook and runs the live verification against an uploaded (not promoted) preview version and production.

## Critical Implementation Details

- **Env precedence:** `node --env-file` does not override variables already set in the environment, so `BASE_URL=<preview> npm run smoke:remote` wins over any `BASE_URL` in `.env.smoke`. The runbook relies on this to reuse one env file for preview and production.
- **Anonymous-blocked check must not send the Access headers or the cookie jar** — otherwise a stale `CF_Authorization` cookie would make it pass for the wrong reason. It runs first, before any Access cookie is stored.
- **Mode selection is all-or-nothing:** setting only one of `SMOKE_EMAIL`/`SMOKE_PASSWORD`, or only one of the two `CF_ACCESS_*` values, must exit non-zero with a clear message instead of silently falling back to local mode.

## Phase 1: Exact redirect assertions

### Overview

Replace the prefix match with an exact redirect matcher, cover it with `node:test`, and run those tests in CI. The 8-step local flow is unchanged in shape.

### Changes Required:

#### 1. Redirect matcher module

**File**: `scripts/smoke-match.mjs` (new)

**Intent**: One pure, dependency-free function deciding whether an actual response matches an expected one, so the rule is testable in isolation and cannot regress to a prefix check.

**Contract**: `export function matches(actual, expected, baseUrl)` → `boolean`, where `actual = { status, location }` and `expected = { status, path?, error? }`. When `path` is given: `location` is resolved with `new URL(location, baseUrl)`; its origin must equal `baseUrl`'s origin and its `pathname` must equal `path` exactly; `error: true` requires a non-empty `error` search param, otherwise an `error` param must be absent. When `path` is omitted, only `status` is compared.

#### 2. Matcher tests

**File**: `scripts/smoke-match.test.mjs` (new)

**Intent**: Pin the regressions that already happened and the edge cases of the new rule.

**Contract**: `node:test` + `node:assert/strict`. Cases at minimum: `/auth/signin?error=x` does **not** match `{302, path:"/"}` (the Pass 1 false pass); `/` matches `{302, path:"/"}`; `/auth/signin?error=Invalid` matches `{302, path:"/auth/signin", error:true}`; `/auth/signin` (no error) does not; `/auth/signin?error=` (empty) does not; `/auth/signinx` does not match `/auth/signin`; an absolute same-origin `Location` matches; a foreign-origin `Location` with the right path does not; wrong status fails even with the right path.

#### 3. Smoke test uses the matcher

**File**: `scripts/smoke.mjs`

**Intent**: Switch the step expectations to `{ status, path, error }` and use `matches()`; keep the eight existing steps, names and order.

**Contract**: expectations become — dashboard anon `{302, path:"/auth/signin"}`; signup `{302, path:"/auth/confirm-email"}`; wrong password `{302, path:"/auth/signin", error:true}`; correct password `{302, path:"/"}`; signout `{302, path:"/"}`; post-signout dashboard `{302, path:"/auth/signin"}`. The FAIL line prints the full expectation.

#### 4. Test script and CI

**File**: `package.json`, `.github/workflows/ci.yml`

**Intent**: Make the matcher tests a first-class, CI-enforced check.

**Contract**: new npm script `"test:smoke": "node --test \"scripts/*.test.mjs\""` — a quoted glob, because Node 22+ no longer recurses a directory argument (`node --test scripts/` errors with "Cannot find module"), and the glob keeps `smoke.mjs` (which fires network requests) out of the test run. The `ci` job runs `npm run test:smoke` after `npm run lint`.

#### 5. Lint globals for scripts

**File**: `eslint.config.js`

**Intent**: The matcher uses `new URL()`, but `scriptsConfig` declares only `console`/`process`/`fetch`/`URLSearchParams` while `no-undef` stays on.

**Contract**: add `URL: true` to `scriptsConfig.languageOptions.globals`; nothing else changes.

### Success Criteria:

#### Automated Verification:

- Matcher tests pass: `npm run test:smoke`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Local 8/8: with `npx supabase start` running, `npm run build` + `npm run preview` + `npm run smoke` passes all 8 steps (CI's `smoke` job re-confirms this after a push, which happens only when the user asks)

#### Manual Verification:

- Reviewing a deliberately broken run (temporarily point the correct-password step at a wrong password locally) shows FAIL for `signin accepts correct password`, then revert

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Remote smoke mode

### Overview

Add an environment-selected remote mode (pre-confirmed account, no sign-up), Cloudflare Access service-token support with an anonymous-blocked check, and the local env-file plumbing and docs.

### Changes Required:

#### 1. Mode selection and step lists

**File**: `scripts/smoke.mjs`

**Intent**: When `SMOKE_EMAIL` and `SMOKE_PASSWORD` are both set, run the remote step list against that existing account; otherwise run today's local list with a generated `@example.com` address.

**Contract**: Remote steps, in order: home 200; dashboard anon → `/auth/signin`; wrong password → `/auth/signin` + error; correct password → `/`; dashboard 200; signout → `/`; dashboard → `/auth/signin`. No request to `/api/auth/signup` in remote mode. The first output line states the mode (`mode: local` / `mode: remote`) and `BASE_URL`, never the password. Only one of the pair set → exit 1 with an explanatory message.

#### 2. Cloudflare Access support

**File**: `scripts/smoke.mjs`

**Intent**: Reach an Access-protected preview with a service token, and prove the protection exists.

**Contract**: When `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are both set, `request()` adds headers `CF-Access-Client-Id` / `CF-Access-Client-Secret` (only one set → exit 1). When `SMOKE_EXPECT_ACCESS=1`, a first step `preview blocks anonymous request` sends `GET /` **without** Access headers and **without** the cookie jar and passes only if the response is not a 200 from the app: status 401/403, or a 302 whose `Location` host ends with `.cloudflareaccess.com`. `SMOKE_EXPECT_ACCESS=1` without the Access credentials → exit 1.

#### 3. Local env file plumbing

**File**: `.env.smoke.example` (new), `.gitignore`, `package.json`

**Intent**: One gitignored place for remote-smoke credentials, with a committed template.

**Contract**: `.env.smoke.example` lists `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` with `###` placeholders and a comment that `BASE_URL`/`SMOKE_EXPECT_ACCESS` are passed per run. `.gitignore` gains `.env.smoke`. New npm script `"smoke:remote": "node --env-file=.env.smoke scripts/smoke.mjs"`.

#### 4. Agent docs

**File**: `AGENTS.md`

**Intent**: Future agents know the two modes and never commit `.env.smoke`.

**Contract**: The `npm run smoke` bullet under `## Commands` gains a sibling for `npm run test:smoke` and `npm run smoke:remote` (env vars, no sign-up on hosted, Access check); the "update it when changing auth routes" sentence under `### Auth flow` also names `scripts/smoke-match.mjs`.

### Success Criteria:

#### Automated Verification:

- Matcher tests still pass: `npm run test:smoke`
- Lint passes: `npm run lint`
- `git check-ignore .env.smoke` reports the file as ignored
- Local mode unchanged: with no `SMOKE_*` env set, `npm run smoke` against local preview + local Supabase still passes 8/8 and prints `mode: local`
- Misconfiguration guard: `SMOKE_EMAIL=x npm run smoke` exits non-zero with the "both must be set" message, without sending requests

#### Manual Verification:

- Against a local `npm run preview` + local Supabase, a user created through the sign-up page and then run with `SMOKE_EMAIL`/`SMOKE_PASSWORD` set passes all 7 remote steps and prints `mode: remote`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Access setup, runbook and live verification

### Overview

The human performs the account/dashboard setup; the agent writes the release runbook and runs the remote smoke against a freshly uploaded (unpromoted) preview and against production.

### Changes Required:

#### 1. Human-only setup (no repo changes)

**File**: — (Cloudflare Zero Trust dashboard, Supabase dashboard, local `.env.smoke`)

**Intent**: Create the protection and the credentials the remote smoke needs; these are human-only per `infrastructure.md` Operational Story.

**Contract**: (a) Workers → `subtracker` → Settings → Domains & Routes → Preview URLs: enable Cloudflare Access, allowing the owner's email. (b) Zero Trust → Access → Service Auth: create a service token; add a **Service Auth** policy for it on the preview-URL Access application. (c) Create the smoke test account by signing up on the production site with a real address you control and clicking the confirmation link — this is the one-time proof of hosted sign-up + confirmation. (d) Copy `.env.smoke.example` to `.env.smoke` and fill the four values.

#### 2. Release runbook and status update

**File**: `context/plans/deployment-plan.md`

**Intent**: Make the safe release path the documented default and close out the items F-01 resolves.

**Contract**: New section `## Release runbook` (before `## Execution record`): `npm run build` → `npx wrangler versions upload` (it ships `dist/` as-is; `wrangler.jsonc` has no build step) → `BASE_URL=<preview-url> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` must pass all 8 steps → human approves → `versions deploy` → `BASE_URL=<production-url> npm run smoke:remote` must pass 7 → on failure `wrangler rollback`. Every smoke command is shown in both POSIX form and PowerShell form (`$env:BASE_URL="<url>"; $env:SMOKE_EXPECT_ACCESS="1"; npm run smoke:remote`, then `Remove-Item Env:SMOKE_EXPECT_ACCESS` before the production run). States that the local/CI `npm run smoke` covers sign-up and that the remote run never signs up. New `### Pass 3` execution entry recording the version id previewed, the Access setup, and the results. In Pass 2's "Still unverified / Still open": mark Cloudflare Access on previews and the `location` check as resolved by F-01, and the hosted round trip as covered by the one-time manual sign-up plus the remote smoke; scoped API token and GitHub repo secrets remain open.

#### 3. Live verification

**File**: — (commands only)

**Intent**: Prove the end state on real infrastructure without promoting anything.

**Contract**: Agent runs `npm run build`, then `npx wrangler versions upload` (allowed unattended; app code unchanged so this version need not be promoted), then the preview and production runs from the runbook; results go into the Pass 3 entry.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=<preview-url> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` → all 8 steps PASS, including `preview blocks anonymous request`
- `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote` → all 7 steps PASS
- `curl -sI <preview-url>/` without Access headers does not return 200
- Lint passes: `npm run lint`

#### Manual Verification:

- Opening the preview URL in a private browser window shows the Cloudflare Access login, not the app
- The production URL still opens the app directly without an Access prompt
- The test account was created via hosted sign-up and the confirmation email link worked
- `git status` shows no `.env.smoke`, and `deployment-plan.md` runbook + Pass 3 entry read correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `scripts/smoke-match.test.mjs` — exact path, error presence/absence, empty error, path-prefix trap (`/auth/signinx`), absolute vs relative `Location`, foreign origin, status mismatch.

### Integration Tests:

- Local mode, 8 steps, local Supabase (sign-up covered here) — run locally as the phase gate, and by CI's `smoke` job once pushed.
- Remote mode against a local server with a pre-created account (Phase 2 manual).
- Remote mode against an Access-protected preview and against production (Phase 3).

### Manual Testing Steps:

1. Private browser window on the preview URL → Access login appears.
2. Production URL → app loads, no Access prompt.
3. One-time hosted sign-up with a real address → confirmation link → sign-in works.

## Performance Considerations

None — test tooling and configuration only; the app is unchanged.

## Migration Notes

No data or schema migration. One test user is added to production `auth.users` once (Phase 3); the remote smoke adds none.

## References

- Roadmap item: `context/foundation/roadmap.md` — F-01 `safe-release-verification`
- Deploy history and open items: `context/plans/deployment-plan.md` (Pass 1, Pass 2)
- Operational story and risk register: `context/foundation/infrastructure.md:200-241`
- Current smoke test: `scripts/smoke.mjs:5`, `:49`, `:54`, `:66`
- CI smoke job: `.github/workflows/ci.yml:27-55`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Exact redirect assertions

#### Automated

- [x] 1.1 Matcher tests pass: `npm run test:smoke` — 5840e15
- [x] 1.2 Lint passes: `npm run lint` — 5840e15
- [x] 1.3 Type check passes: `npx astro check` — 5840e15
- [x] 1.4 Local 8/8: build + preview + `npm run smoke` against local Supabase — 5840e15

#### Manual

- [x] 1.5 Deliberately broken correct-password step shows FAIL, then reverted — 5840e15

### Phase 2: Remote smoke mode

#### Automated

- [x] 2.1 Matcher tests still pass: `npm run test:smoke` — bcee409
- [x] 2.2 Lint passes: `npm run lint` — bcee409
- [x] 2.3 `git check-ignore .env.smoke` reports the file as ignored — bcee409
- [x] 2.4 Local mode unchanged: `npm run smoke` 8/8 against local Supabase, prints `mode: local` — bcee409
- [x] 2.5 Misconfiguration guard: `SMOKE_EMAIL=x npm run smoke` exits non-zero without sending requests — bcee409

#### Manual

- [x] 2.6 Remote mode against local preview + local Supabase passes all 7 steps and prints `mode: remote` — bcee409

### Phase 3: Access setup, runbook and live verification

#### Automated

- [x] 3.1 Remote smoke against Access-protected preview passes all 8 steps
- [x] 3.2 Remote smoke against production passes all 7 steps
- [x] 3.3 `curl -sI <preview-url>/` without Access headers does not return 200
- [x] 3.4 Lint passes: `npm run lint`

#### Manual

- [x] 3.5 Preview URL in a private window shows the Cloudflare Access login
- [x] 3.6 Production URL opens the app without an Access prompt
- [x] 3.7 Test account created via hosted sign-up and confirmation link worked
- [x] 3.8 No `.env.smoke` in `git status`; runbook and Pass 3 entry read correctly
