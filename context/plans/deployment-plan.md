# First production deploy — SubTracker → Cloudflare Workers

## Context

`context/foundation/infrastructure.md` (2026-09-23) picked **Cloudflare Workers** as the MVP platform,
with Render as runner-up. The repository is already Workers-shaped — `@astrojs/cloudflare` 14.3.1,
`wrangler` 4.131, a populated `wrangler.jsonc` — so the first deploy is a `wrangler` invocation, not
an adapter migration. Nothing has ever been deployed, and there is no `.env`/`.dev.vars` on disk and
no `supabase/migrations/`. The repo was published to `github.com/lukmas26/10x-subtracker` on
2026-09-24 (`fdf69e1`, first commit).

The goal of this pass is a **live, verified production URL** on Workers, with the human gate kept on
the irreversible step (promotion to production traffic). Supabase is deliberately **not** wired yet —
`SUPABASE_URL`/`SUPABASE_KEY` are `optional` in `env.schema`, so the app boots and degrades via
`src/lib/config-status.ts`. Auth goes live in a later pass once the hosted Supabase project exists.

### Decisions locked with the user

| Decision       | Choice                                                               |
| -------------- | -------------------------------------------------------------------- |
| Supabase       | Create later and link — this deploy ships in degraded (no-auth) mode |
| Worker name    | Rename `10x-astro-starter` → `subtracker`                            |
| Rollout        | `versions upload` → verify preview → human approves → promote        |
| Contract drift | Patch all three fields in `tech-stack.md`                            |

### Hard constraint carried from the research

`wrangler deploy` and `wrangler pages deploy` are **not interchangeable**. Adapter v13 dropped Pages
support; this project pins v14.3. The Pages command must not appear anywhere in this plan or in any
script. (`infrastructure.md` risk register, Devil's advocate #2.)

## Prerequisites — one-time setup

Everything below is done **once per machine / per account**, not once per deploy. Status column
reflects verification run on 2026-09-24 on this workstation.

### A. Local toolchain

| Tool           | Required for                                       | Install                                                               | Verify                   | Status                                         |
| -------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------ | ---------------------------------------------- |
| Node.js        | everything                                         | `nvm install 22.14.0 && nvm use 22.14.0` (version pinned in `.nvmrc`) | `node -v` → `v22.14.0`   | ⚠ **v24.19.0 installed — mismatch, see below** |
| npm            | everything                                         | ships with Node                                                       | `npm -v`                 | ✅ 11.17.0                                     |
| Git            | version control                                    | https://git-scm.com                                                   | `git --version`          | ✅ 2.55.0                                      |
| Project deps   | build, lint, deploy                                | `npm install` in the repo root                                        | `ls node_modules`        | ✅ installed                                   |
| `wrangler`     | Cloudflare deploy                                  | devDependency — no global install; always call as `npx wrangler`      | `npx wrangler --version` | ✅ 4.131.1                                     |
| `supabase` CLI | local Supabase, migrations                         | devDependency — call as `npx supabase`                                | `npx supabase --version` | ✅ 2.117.0                                     |
| Docker         | **only** for local Supabase (`npx supabase start`) | Docker Desktop                                                        | `docker --version`       | ❌ not installed                               |
| `gh` CLI       | reading CI results from the terminal (optional)    | `winget install --id GitHub.cli`, then `gh auth login` (interactive)  | `gh auth status`         | ✅ 2.101.0 installed — ⬜ not authenticated    |

**Node version mismatch.** The machine runs v24.19.0; `.nvmrc` pins 22.14.0 and CI uses Node 22.
Builds may still succeed, but a local pass is then not evidence that CI will pass. Either align
locally (`nvm use`) or accept that CI is the source of truth for build health.

Do **not** install `wrangler` or `supabase` globally. Both are pinned as devDependencies; a global
copy at a different version is a classic source of "works for me" deploy failures.

### B. Cloudflare account

One-time, in this order:

1. **Account** — create at https://dash.cloudflare.com (free plan is sufficient for this MVP;
   Workers Free is 100k requests/**day**).
2. **Authenticate wrangler** — `npx wrangler login`, browser OAuth.
   Verify: `npx wrangler whoami` prints an account name, an account ID, and a scope list containing
   `workers_scripts (write)` and `workers_tail (read)`.
   Credentials persist at `%APPDATA%\xdg.config\.wrangler\config\default.toml` — machine-local,
   never in the repo.
   Status: ✅ done — account `d8dd730000f2b34f4060b5e07da49d11`.
3. **Scoped API token (recommended follow-up).** The OAuth grant above is account-wide — it includes
   `pages:write`, `d1:write`, `zone:read`, `email_sending:write`, `containers:write` and more, far
   beyond what this project needs. Replace it with a token limited to **Workers Scripts:Edit on this
   account only** (no DNS, no billing, no unrelated secrets), exported as `CLOUDFLARE_API_TOKEN`
   in the shell. Never in a committed file. Status: ⬜ pending.
4. **Paid plan ($5/mo)** — not needed now. Required _before_ the first OpenRouter/LLM feature, per
   the CPU-limit risk in `infrastructure.md`. Status: ⬜ not needed yet.

### C. Supabase

Nothing exists yet: no hosted project, no `supabase/migrations/`, no `.env`, no `.dev.vars`. The app
is deliberately shipping without it (see Context above). When you do set it up:

1. **Hosted project** — create at https://supabase.com/dashboard (human-only action: account
   creation and project provisioning). Pick an EU region to sit near the users.
2. **Collect credentials** — Project Settings → API: the project URL and the **anon** key. The anon
   key is the one this app uses; the service-role key must never reach the Worker or the repo.
3. **Local development** — `cp .env.example .env`, fill both values, then `cp .env .dev.vars`
   (workerd reads the latter). Both are gitignored.
   Verify: `npm run dev`, then confirm the Polish config-status banner is **gone** from the homepage.
4. **Production secrets** — `npx wrangler secret put SUPABASE_URL` and
   `npx wrangler secret put SUPABASE_KEY`. You type the values interactively; they are write-only
   once set and the agent never sees them.
   Verify: `npx wrangler secret list` shows both names (values are not retrievable).
5. **Full auth verification** — `BASE_URL=<url> npm run smoke` must report **8/8 PASS**. Anything
   less means the `@supabase/ssr` cookie flow is not surviving the workerd `nodejs_compat` shims.
6. **Local Supabase (optional)** — requires Docker. `npx supabase start`, then use the printed API
   URL and anon key. Not needed if you develop against the hosted project.

Any new environment variable must also be declared in `env.schema` in `astro.config.mjs`, or
`astro:env/server` will not expose it — the variable will simply be `undefined` at runtime.

### D. GitHub

1. **Remote** — `git remote add origin https://github.com/lukmas26/10x-subtracker.git`.
   Status: ✅ done, `master` tracks `origin/master`.
2. **Repo secrets for CI** — Settings → Secrets and variables → Actions: add `SUPABASE_URL` and
   `SUPABASE_KEY`. The `ci` job passes them to the build; without them the build still succeeds
   (both are `optional`), so their absence is silent. The `smoke` job does **not** need them — it
   starts its own local Supabase. Status: ⬜ pending.
3. **Verify CI** — `gh run list` / `gh run view --log`, or the Actions tab if `gh` is not installed.

### E. Ordering

`A → B` is required before any deploy step in this plan. `C` is the deferred pass. `D` is
independent of deployment and only affects CI.

## Step 1 — Configuration edits

✅ **Done** (2026-09-24), committed in `fdf69e1`.

**`wrangler.jsonc`**

- `"name": "10x-astro-starter"` → `"subtracker"`. This is the `*.workers.dev` hostname, so it must
  change before the first deploy — renaming afterwards creates a second Worker and abandons the URL.
- Add a comment above `compatibility_flags` recording that `nodejs_compat` is load-bearing below
  compatibility date `2026-08-04` (current date: `2026-05-08`). Mitigation for the "flag removed as
  redundant" risk. No behavioural change.

**`context/foundation/tech-stack.md`** — reconcile the three recorded drifts:

- `deployment_target: cloudflare-pages` → `cloudflare-workers`
- `has_realtime: false` → `true`
- `has_ai: false` → `true`

## Step 2 — Build and verify on the real runtime, locally

```
npx astro sync          # generates .astro/ types; not present on this checkout
npm run lint
npx astro check
npm run build
```

Then confirm `dist/` no longer contains the stale `dist/index.js` from the old TypeScript scaffold.
`dist/` is the `ASSETS` binding directory, so anything left there is **publicly served**. Astro clears
`outDir` on build; this is a verification, not an edit.

```
npm run preview         # adapter v14 runs this on workerd — real runtime fidelity
BASE_URL=http://localhost:4321 npm run smoke
```

**Expected result in degraded mode: exit code 1, with exactly these three failures** — anything else
is a real problem:

| Smoke step                           | Degraded outcome                                                     |
| ------------------------------------ | -------------------------------------------------------------------- |
| home renders                         | PASS                                                                 |
| dashboard redirects anonymous user   | PASS                                                                 |
| signup creates account               | **FAIL** → `302 /auth/signup?error=Supabase%20is%20not%20configured` |
| signin rejects wrong password        | PASS (passes for the wrong reason — prefix-matches `?error=`)        |
| signin accepts correct password      | **FAIL** → `302 /auth/signin?error=…`                                |
| dashboard renders for signed-in user | **FAIL** → `302 /auth/signin`                                        |
| signout clears session               | PASS                                                                 |
| dashboard redirects after signout    | PASS                                                                 |

Do **not** add `wrangler dev` here. Base runtime fidelity already comes from `npm run preview`;
`wrangler dev` only earns its place once Durable Object / KV / D1 bindings exist.

## Step 3 — Cloudflare authentication (manual gate)

✅ **Done** — see Prerequisites § B. `npx wrangler login` was run by the user; `npx wrangler whoami`
confirms account `d8dd730000f2b34f4060b5e07da49d11` with `workers_scripts (write)`. The OAuth session
persists across shells, so this does not repeat per deploy.

Outstanding from § B: swapping the account-wide OAuth grant for a scoped `CLOUDFLARE_API_TOKEN`.

## Step 4 — Upload a version without publishing

```
npx wrangler versions upload
```

Returns a preview URL and routes **no** production traffic to it. Verify against that URL:

```
curl -sI <preview-url>/                    # 200
curl -sI <preview-url>/dashboard           # 302 → /auth/signin
BASE_URL=<preview-url> npm run smoke       # same 3-failure signature as Step 2
```

Confirm the Polish `config-status` banner renders on the preview home page — that is the positive
proof the app is running degraded-but-healthy rather than half-configured. Preview exposure is
acceptable here precisely because there is no Supabase and therefore no financial data; once
Supabase is linked, Cloudflare Access goes in front of preview URLs (deferred pass below).

## Step 5 — Promote (human approval required)

Stop and report the preview results. **Only after you say go:**

```
npx wrangler versions deploy <version-id>
```

Per `infrastructure.md`'s operational story, promoting to production traffic is a human-gated action.
The agent does not run this on its own initiative.

## Step 6 — Watch and keep rollback one command away

```
npx wrangler tail                # live logs; --format json if it needs parsing
```

Hit the production URL, confirm 200 on `/` and the 302 on `/dashboard` in the tail output.
`observability.enabled` is already `true`, so invocation logs persist in the dashboard.

Rollback: `npx wrangler rollback` (previous version) or `npx wrangler rollback <version-id>`. Under a
minute, no rebuild. Safe here because this deploy carries **no** schema change — the rollback caveat
in the risk register (Supabase migrations do not roll back with the Worker) does not apply yet.

## Step 7 — Record the outcome in this file

Append an **Execution record** section to this document once the deploy lands: the exact commands
run, the version id promoted, the production URL, which secrets are wired (none) and which are
pending, the degraded-mode smoke signature, and the rollback command. This file is the audit trail of
"what was supposed to happen" versus what did, and the hand-off downstream milestone planning reads as
ground truth for "what is already deployed".

> Note: `CLAUDE.md` names `context/deployment/deploy-plan.md` as that artifact's path. This plan lives
> at `context/plans/deployment-plan.md` at your request; the execution record stays here rather than
> being split across two files.

## Deferred to a follow-up pass (not this deploy)

1. **Supabase link.** You create the hosted project (human-only), then:
   `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY` — you type the
   values; the agent never sees them. Redeploy, then re-run the full smoke test and expect **8/8
   PASS**. That run is the real proof the `@supabase/ssr` cookie flow survives `nodejs_compat` shims
   on workerd (Devil's advocate #4).
2. **Cloudflare Access in front of preview URLs** — required before any preview renders real records.
3. **`.dev.vars`** for local development against Supabase (gitignored; copy from `.env.example`).
4. **CI deploy.** `.github/workflows/ci.yml` exists but there is no git remote, so it has never run.
   Wiring push-to-deploy is out of scope here and out of scope in `infrastructure.md`.

## Explicitly not doing

- No `wrangler pages deploy`, no Pages project — Workers only.
- No Dockerfile, no CI/CD pipeline changes, no Durable Objects, no Hyperdrive.
- No `git commit` / `git push` unless you ask; the repo has no remote and is on `master`.
- No touching `context/archive/`.

## Verification — how we know it worked

1. `npx astro check` and `npm run lint` clean after the config edits.
2. Local `npm run preview` + smoke produces exactly the 3-failure degraded signature above.
3. The preview URL from `versions upload` produces the same signature — proving workerd parity.
4. After promotion: production `/` returns 200 with the config banner, `/dashboard` returns 302 to
   `/auth/signin`, and `wrangler tail` shows those invocations live.
5. `npx wrangler versions list` shows the promoted version at 100%.
6. This file carries an execution record naming the version id and production URL.

## Release runbook

Added by change `safe-release-verification` (roadmap F-01). This is the default path for every
release from now on. Preview URLs sit behind Cloudflare Access, and the smoke test checks redirect
paths exactly.

**One-time setup** (human-only; done in Pass 3):

- Cloudflare Access is enabled on the Worker's **Preview URLs**, and the policy allows the owner's
  e-mail.
- A Zero Trust service token (`subtracker-smoke`) has a **Service Auth** policy on that Access
  application.
- A confirmed test account exists on hosted Supabase. It was created through the production sign-up
  page, and its confirmation link was clicked.
- `.env.smoke` holds `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `CF_ACCESS_CLIENT_ID` and
  `CF_ACCESS_CLIENT_SECRET`. It is copied from `.env.smoke.example`, gitignored, and never read by the
  agent.

**Coverage.** `npm run smoke` (local and CI) covers sign-up on every run against local Supabase.
`npm run smoke:remote` **never signs up**: it signs in with the test account. Hosted sign-up and e-mail
confirmation were proven once, by hand, when the test account was created. Variables set in the shell
take precedence over `.env.smoke`, so `BASE_URL` is passed per run. Remote mode only reads
`/subscriptions` (it never adds a subscription), so no test data accumulates in the shared database;
the add flow and cross-account isolation are covered by the local smoke and `npm run test:rls`.

**Per release:**

1. Local gates: `npm run lint`, `npm run test:smoke`, `npx astro check`, `npm run test:rls` (local
   Supabase only), then a local `npm run smoke` at 16/16.
2. Build, then upload a version without promoting it. `wrangler.jsonc` has no build step, so
   `versions upload` ships whatever is currently in `dist/`.
   - **Apply pending migrations first** (human-only): `npx supabase db push` against the linked
     hosted project, before uploading a version that needs them. Preview and production share the
     hosted database, so the migration must be additive — the live version keeps running on it.
     Worker rollback does not revert it.
   - Stop any running local `npm run preview` first. On Windows it locks `dist/`, and the build then
     fails with `EPERM`.
   - Upload only after the build exits 0.

   ```
   npm run build
   npx wrangler versions upload          # prints the version id and preview URL
   ```

3. Verify the preview. All **10** steps must pass, including `preview blocks anonymous request`.

   ```bash
   BASE_URL=<preview-url> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote
   ```

   ```powershell
   $env:BASE_URL="<preview-url>"; $env:SMOKE_EXPECT_ACCESS="1"; npm run smoke:remote
   Remove-Item Env:SMOKE_EXPECT_ACCESS
   ```

4. **Human approval.** Promote only after the user says go:
   `npx wrangler versions deploy <version-id>@100% -y`.
5. Verify production. All **9** steps must pass. Production has no Access, so `SMOKE_EXPECT_ACCESS`
   must be unset.

   ```bash
   BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote
   ```

   ```powershell
   $env:BASE_URL="https://subtracker.lukasz-maslowski.workers.dev"; npm run smoke:remote
   Remove-Item Env:BASE_URL
   ```

   `smoke:remote` sends the Access service token on **every** request, including the one to
   production, so on its own it cannot detect production sitting behind Access. Also check that
   production stays public. An anonymous request must return `200`, not a `302` to
   `*.cloudflareaccess.com`:

   ```
   curl.exe -s -o NUL -w "%{http_code}\n" https://subtracker.lukasz-maslowski.workers.dev/
   ```

6. On failure, roll back with `npx wrangler rollback` (to the previous version) or
   `npx wrangler rollback <version-id>`. Worker rollback does not revert Supabase migrations.

Test-account hygiene: the remote smoke writes no users. Rotate `SMOKE_PASSWORD` in the Supabase
dashboard if it leaks.

## Execution record

### Pass 1 — 2026-09-26 (first deploy, degraded mode)

**Deviation from Step 4/5:** `npx wrangler versions upload` fails on a Worker that has never been
deployed (`You cannot upload a new version of a Worker that does not yet exist. Please run the
deploy command first.`). With the user's approval, the first release went out as `npx wrangler deploy`
(live at 100% right away). The gated flow (`versions upload` / `versions secret put` → verify preview
→ human approves → `versions deploy`) applies to every release **after** this one.

Local setup: `npx supabase start` (Docker, run by the user). `.env` and `.dev.vars` point at the local
stack (`http://127.0.0.1:54321` + the local demo anon key); both are gitignored.

Commands run:

```
npx astro sync && npm run lint && npx astro check && npm run build   # all clean
npm run preview  +  npm run smoke                                   # 8/8 PASS against local Supabase
npx wrangler versions upload                                        # rejected — Worker did not exist
npx wrangler deploy                                                 # user approved
BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke
```

| Item             | Value                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production URL   | https://subtracker.lukasz-maslowski.workers.dev                                                                                                                         |
| Live version     | `ea571db7-bfe6-411f-89a5-6335222e7049` (100%)                                                                                                                           |
| Auto-provisioned | KV namespace `subtracker-session` (`6a605027a7d043dea58feced919d719b`), bound as `SESSION` by the Astro adapter's sessions support — not mentioned in the original plan |
| Other bindings   | `IMAGES` (Cloudflare Images), `ASSETS` (`./dist`)                                                                                                                       |
| Secrets wired    | none                                                                                                                                                                    |
| Secrets pending  | `SUPABASE_URL`, `SUPABASE_KEY` (hosted project)                                                                                                                         |
| Rollback         | none possible yet (first version); afterwards `npx wrangler rollback`                                                                                                   |

The workerd-local run with a real Supabase got **8/8 PASS**, confirming that the `@supabase/ssr` cookie flow
survives the `nodejs_compat` shims (Devil's advocate #4, locally).

Production smoke in degraded mode: `/` 200 with the Polish config banner, `/dashboard` 302 →
`/auth/signin`. **2 failures, not the 3 predicted in Step 2:** `signin accepts correct password`
passes for the wrong reason, because the smoke test prefix-matches `location` and `/auth/signin?error=…`
starts with `/`. That assertion in `scripts/smoke.mjs` is too weak and should be tightened.

### Pass 2 — 2026-09-26 (Supabase secrets, gated promotion)

1. The user ran `npx wrangler versions secret put SUPABASE_URL` and `… SUPABASE_KEY` (hosted project,
   anon key). Each call created a new version without deploying it. The final one is
   `acbce2f0-84a8-409b-997c-c433a62b8016`. `npx wrangler secret list` shows both names.
2. Preview check on `https://acbce2f0-subtracker.lukasz-maslowski.workers.dev`: the config banner is gone.
   `BASE_URL=<preview> npm run smoke` gave **6/8**. Hosted Supabase rejects the smoke test's
   `@example.com` sign-up address (`Email address "…" is invalid`), so the signed-in steps can't
   run. Wrong-password sign-in returns `Invalid login credentials` from the hosted project, which
   proves the URL and key are valid.
3. The user approved, then: `npx wrangler versions deploy acbce2f0-84a8-409b-997c-c433a62b8016@100% -y`.
4. Production check: `/` 200 with no banner, `/dashboard` 302 → `/auth/signin`, wrong-password POST
   (with an `Origin` header; without one Astro's CSRF check returns 403) → `?error=Invalid login credentials`.

| Item          | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Live version  | `acbce2f0-84a8-409b-997c-c433a62b8016` (100%)                                          |
| Secrets wired | `SUPABASE_URL`, `SUPABASE_KEY`                                                         |
| Rollback      | `npx wrangler rollback ea571db7-bfe6-411f-89a5-6335222e7049` (degraded, no-auth build) |

**Still unverified:** a full sign-up → confirm → sign-in → `/dashboard` round trip on hosted Supabase.
It needs a real email address, or a smoke test that takes the address domain from an env var.
**Still open:** a scoped `CLOUDFLARE_API_TOKEN`, GitHub repo secrets for CI, Cloudflare Access in front
of preview URLs (needed now that previews reach a real database), and a tighter `location` check in
`scripts/smoke.mjs`.

> **Update 2026-10-02 (Pass 3, change `safe-release-verification`):** the hosted round trip is now
> covered by the one-time manual sign-up and confirmation of the smoke test account, plus
> `smoke:remote` on every release. Cloudflare Access on preview URLs is ✅ done. The exact `location`
> check is ✅ done (`scripts/smoke-match.mjs`). Still open: a scoped `CLOUDFLARE_API_TOKEN` and
> GitHub repo secrets for CI.

### Pass 3 — 2026-10-02 (protected previews, remote smoke; no promotion)

Change `safe-release-verification` (roadmap F-01), commits `5840e15` (exact redirect assertions) and
`bcee409` (remote smoke mode). It follows the new `## Release runbook`.

1. The user did the human-only setup:
   - turned on Cloudflare Access for the Worker's Preview URLs (team domain
     `fancy-hill-14b6.cloudflareaccess.com`);
   - created the service token `subtracker-smoke` and gave it a **Service Auth** policy on that
     application;
   - created the smoke test account through the production sign-up page and confirmed it by e-mail;
   - filled in `.env.smoke`, which is gitignored and was never read by the agent.

   Two checks with `curl` passed. Without the token, the Pass 2 preview returns `302` to the Access
   login. With the token, it returns `200`.

2. `npm run build` + `npx wrangler versions upload` → `05ed91ff-dacd-40d1-85cc-376e22f5330b`
   (preview `https://05ed91ff-subtracker.lukasz-maslowski.workers.dev`).
   - **Deviation:** the first build failed with `EPERM` on `dist\client`. A local `npm run preview`
     still had the folder open on Windows, but the upload ran anyway. That produced version
     `d99545c2-fc91-48d8-bb30-3fc0a133a75b` from the stale `dist/`.
   - That version was never verified or promoted. Ignore it.
   - Lesson: stop any local preview before building, and do not chain `versions upload` after a
     failed build.
3. `BASE_URL=<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` gave **8/8 PASS**. This includes
   `preview blocks anonymous request` (`302` → `fancy-hill-14b6.cloudflareaccess.com`) and sign-in →
   `/dashboard` → sign-out against hosted Supabase.
4. `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote` gave **7/7 PASS**.
5. Nothing was promoted, because the app code is unchanged. `npx wrangler deployments status` still
   shows `acbce2f0` at 100%.
6. **Incident: production was behind Access.**
   - What happened: during manual check 3.6, the production URL showed the Access login. Step 1 had
     enabled Access on the **workers.dev** route as well as on Preview URLs, so the public app was
     closed to users.
   - Why step 4 missed it: its 7/7 had passed only because `.env.smoke` also sends the service token
     to production.
   - Fix: the user disabled Access on workers.dev and left it on for Preview URLs.
   - Re-check: production answers `200` to an anonymous request, the preview gives `302` to Access,
     and `smoke:remote` on production is 7/7 again.
   - The runbook's step 5 now includes the anonymous `curl` check.

| Item              | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Live version      | `acbce2f0-84a8-409b-997c-c433a62b8016` (100%, unchanged)           |
| Verified preview  | `05ed91ff-dacd-40d1-85cc-376e22f5330b` (not promoted)              |
| Stale upload      | `d99545c2-fc91-48d8-bb30-3fc0a133a75b` (stale `dist/`, ignore)     |
| Preview access    | Cloudflare Access; service token `subtracker-smoke` (Service Auth) |
| Remote smoke      | preview 8/8, production 7/7                                        |
| Production access | public: anonymous `200` (Access applies to Preview URLs only)      |

### Pass 4 — 2026-10-03 (first schema migration; subscriptions list)

Change `first-subscription-on-list` (roadmap S-01), commits `fa0260b` (schema, RLS, `test:rls`),
`26a7d27` (service, API, `/subscriptions`) and `06da851` (smoke coverage). The first release that
carries a database migration; it follows the runbook, including the new migration step.

1. Local gates: `npm run lint`, `npm run test:smoke` (21/21), `npx astro check`, `npm run test:rls`
   (12/12) and local `npm run smoke` (16/16), all green.
2. The user ran `npx supabase login`, `npx supabase link` and `npx supabase db push` in their own
   terminal (`supabase login` needs a TTY, so it cannot run through the agent's shell). That applied
   `20261003120000_subscriptions_and_categories.sql` to the hosted project. In the dashboard:
   `categories` has the 8 starter rows, and RLS is on for both tables.
3. The local `npm run preview` was stopped first, so `dist/` was not locked. Then `npm run build` and
   `npx wrangler versions upload` produced `b00106c6-cab3-4853-9916-7dfb00af2bd1` (preview
   `https://b00106c6-subtracker.lukasz-maslowski.workers.dev`).
4. `BASE_URL=<preview> SMOKE_EXPECT_ACCESS=1 npm run smoke:remote` gave **10/10 PASS**.
5. Manual check on the preview: the owner's account added a subscription and saw it, and the smoke
   test account did not see it on `/subscriptions`.
6. The user approved, then: `npx wrangler versions deploy b00106c6-cab3-4853-9916-7dfb00af2bd1@100% -y`.
7. `BASE_URL=https://subtracker.lukasz-maslowski.workers.dev npm run smoke:remote` gave **9/9 PASS**.
   Anonymous `curl`: `/` returns `200` and `/subscriptions` returns `302` → `/auth/signin`.
   Production stays public.

| Item         | Value                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Live version | `b00106c6-cab3-4853-9916-7dfb00af2bd1` (100%)                                                                      |
| Migration    | `20261003120000_subscriptions_and_categories.sql` (additive)                                                       |
| Remote smoke | preview 10/10, production 9/9                                                                                      |
| Rollback     | `npx wrangler rollback acbce2f0-84a8-409b-997c-c433a62b8016` (the tables stay; the old version never touches them) |
