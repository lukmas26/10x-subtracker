# First production deploy — SubTracker → Cloudflare Workers

## Context

`context/foundation/infrastructure.md` (2026-09-23) picked **Cloudflare Workers** as the MVP platform,
with Render as runner-up. The repository is already Workers-shaped — `@astrojs/cloudflare` 14.3.1,
`wrangler` 4.131, a populated `wrangler.jsonc` — so the first deploy is a `wrangler` invocation, not
an adapter migration. Nothing has ever been deployed: there is no `.env`/`.dev.vars` on disk, no
`supabase/migrations/`, no git remote, and `dist/` still holds `index.js` from the pre-Astro scaffold.

The goal of this pass is a **live, verified production URL** on Workers, with the human gate kept on
the irreversible step (promotion to production traffic). Supabase is deliberately **not** wired yet —
`SUPABASE_URL`/`SUPABASE_KEY` are `optional` in `env.schema`, so the app boots and degrades via
`src/lib/config-status.ts`. Auth goes live in a later pass once the hosted Supabase project exists.

### Decisions locked with the user

| Decision | Choice |
|---|---|
| Supabase | Create later and link — this deploy ships in degraded (no-auth) mode |
| Worker name | Rename `10x-astro-starter` → `subtracker` |
| Rollout | `versions upload` → verify preview → human approves → promote |
| Contract drift | Patch all three fields in `tech-stack.md` |

### Hard constraint carried from the research

`wrangler deploy` and `wrangler pages deploy` are **not interchangeable**. Adapter v13 dropped Pages
support; this project pins v14.3. The Pages command must not appear anywhere in this plan or in any
script. (`infrastructure.md` risk register, Devil's advocate #2.)

## Step 1 — Configuration edits

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

| Smoke step | Degraded outcome |
|---|---|
| home renders | PASS |
| dashboard redirects anonymous user | PASS |
| signup creates account | **FAIL** → `302 /auth/signup?error=Supabase%20is%20not%20configured` |
| signin rejects wrong password | PASS (passes for the wrong reason — prefix-matches `?error=`) |
| signin accepts correct password | **FAIL** → `302 /auth/signin?error=…` |
| dashboard renders for signed-in user | **FAIL** → `302 /auth/signin` |
| signout clears session | PASS |
| dashboard redirects after signout | PASS |

Do **not** add `wrangler dev` here. Base runtime fidelity already comes from `npm run preview`;
`wrangler dev` only earns its place once Durable Object / KV / D1 bindings exist.

## Step 3 — Cloudflare authentication (manual gate)

`wrangler login` opens a browser for OAuth — you run it, not the agent:

```
! npx wrangler login
```

Then `npx wrangler whoami` to confirm the account and note the `workers.dev` subdomain. If you would
rather use a scoped API token than a full OAuth session, create one limited to **Workers Scripts:Edit
for this project only** — no DNS, no billing, no unrelated Workers Secrets — and export it as
`CLOUDFLARE_API_TOKEN` in the shell. Never in a committed file.

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
