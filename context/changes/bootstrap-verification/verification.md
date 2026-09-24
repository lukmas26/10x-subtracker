---
bootstrapped_at: 2026-09-20T06:05:35Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: subtracker
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md`.

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: subtracker
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Solo developer shipping a subscription-tracking MVP in one week of after-hours work, against a fixed deadline. The PRD's must-have set is login with two roles, CRUD on subscriptions, a spending summary, and a duplicate-category recommendation — so auth plus a relational store are the load-bearing needs, and neither deserves hand-rolling under a one-week budget. 10x Astro Starter is the recommended default for a web app in JavaScript/TypeScript and ships auth, PostgreSQL, and edge deploy together; it clears all four agent-friendly gates, and its TypeScript-first posture suits a developer who is experienced in code but new to supervising agents. Bootstrapper confidence is first-class, so scaffolding should be smooth with occasional hiccups rather than manual assembly. Payments are false deliberately: the product records subscriptions, it never charges for them, and PRD non-goals rule out bank integration. AI and background jobs are false for the MVP — automatic categorization and fetching plan details from provider sites are nice-to-have requirements scoped out for later, and the starter's edge runtime will need a separate worker when they land.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | `cmd_template` starts with `git clone`; there is no `create-*` CLI to resolve, so the npm step is skipped per the reference |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12 | fresh | from `card.docs_url`; `gh` is not installed on this machine, so the same field was read from the public GitHub REST API via `curl` |

Both signals are WARN-AND-CONTINUE by design. Nothing here gated the scaffold.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 44

**Conflicts (.scaffold siblings)**: `CLAUDE.md`, `README.md`, `package.json`, `package-lock.json`, `eslint.config.js`, `tsconfig.json`, `node_modules`

**.gitignore handling**: append-merged — the existing `node_modules/`, `dist/`, `*.log` lines were kept in order, then 26 lines from the starter (11 ignore patterns plus its section comments and blank lines) were appended after a `# from 10x-astro-starter` separator. Two scaffold patterns, `dist/` and `node_modules/`, were de-duped out as exact matches of lines already present. New patterns: `.astro/`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`, `.env`, `.env.production`, `.dev.vars`, `.wrangler/`, `.DS_Store`, `.idea/`.

The starter's `.gitignore` ships with CRLF line endings. The first pass of the merge compared them against the repo's LF lines verbatim, so the de-dupe missed `dist/` and `node_modules/` and the appended block carried stray carriage returns. Both were corrected in place before this log was finalised: the appended block is LF-normalised and de-duped as described above. Duplicate ignore patterns are harmless under git's additive semantics, so nothing was at risk either way.

**.bootstrap-scaffold cleanup**: deleted

### Notes on the move-up

- `.bootstrap-scaffold/.git/` was deleted before the move-up, so the upstream starter's history did not leak into this repo. The repo's own existing `.git/` was left untouched.
- The scaffold contained no `context/**` paths, so the drop rule had nothing to drop. The repo's `context/` is intact.
- `node_modules` was handled at directory granularity rather than file by file. The scaffold's installed tree (30,680 files) clashed with the repo's existing `node_modules`, so it was sidelined whole as `node_modules.scaffold`. Applying the matrix across 30k individual paths would have produced an interleaved tree belonging to neither `package.json`. Sidelined whole, `node_modules.scaffold` stays coherent with `package.json.scaffold` and `package-lock.json.scaffold`, and it is safe to delete and reinstall from the lockfile.
- 0 files were dropped. The matrix deleted no user files.

### Full move log

| Resolution | Paths |
| --- | --- |
| Moved (44) | `.env.example`, `.github/workflows/ci.yml`, `.husky/pre-commit`, `.nvmrc`, `.prettierrc.json`, `.vscode/extensions.json`, `.vscode/launch.json`, `.vscode/settings.json`, `AGENTS.md`, `astro.config.mjs`, `components.json`, `public/.assetsignore`, `public/favicon.png`, `public/template.png`, `scripts/smoke.mjs`, `src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/Banner.astro`, `src/components/Topbar.astro`, `src/components/ui/button.tsx`, `src/components/ui/LibBadge.astro`, `src/components/Welcome.astro`, `src/env.d.ts`, `src/layouts/Layout.astro`, `src/lib/config-status.ts`, `src/lib/supabase.ts`, `src/lib/utils.ts`, `src/middleware.ts`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`, `src/pages/api/auth/signup.ts`, `src/pages/auth/confirm-email.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/dashboard.astro`, `src/pages/index.astro`, `src/styles/global.css`, `supabase/.gitignore`, `supabase/config.toml`, `wrangler.jsonc` |
| Sidelined (7) | `CLAUDE.md` → `CLAUDE.md.scaffold`; `README.md` → `README.md.scaffold`; `package.json` → `package.json.scaffold`; `package-lock.json` → `package-lock.json.scaffold`; `eslint.config.js` → `eslint.config.js.scaffold`; `tsconfig.json` → `tsconfig.json.scaffold`; `node_modules/` → `node_modules.scaffold/` |
| Append-merged (1) | `.gitignore` |
| Dropped (0) | none |

## Post-scaffold audit

**Tool**: `npm audit --json`

**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0 — no findings to split

### Primary audit (repo `package.json` + `node_modules`, as they stand post-merge)

Run from the repo root. Exit code 0. `metadata.vulnerabilities`: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`. Dependency counts: 1 prod, 139 dev, 27 optional, 139 total. Advisory entries: 0.

Because the conflict policy let the repo's existing `package.json` win, this primary audit describes the repo's pre-existing dependency tree, not the starter's.

### Supplementary audit (the starter's own tree)

To give the audit slot a meaningful signal about what the starter actually ships, `npm audit --package-lock-only --json` was run against copies of `package.json.scaffold` and `package-lock.json.scaffold` in a scratch directory. Nothing in the project was installed or modified.

Exit code 0. `metadata.vulnerabilities`: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`. Dependency counts: 377 prod, 269 dev, 167 optional, 804 total. Advisory entries: 0.

`npm install` during the scaffold step independently reported `found 0 vulnerabilities` across the 649 packages it audited at install time.

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

### Non-blocking install warning

`npm install` emitted an `allow-scripts` warning: 3 packages ship install scripts not yet covered by allowScripts — `esbuild@0.28.2` (postinstall: `node install.js`), `workerd@1.20260911.1` (postinstall: `node install.js`), `esbuild@0.28.1` (postinstall: `node install.js`). This is not an advisory and is not an audit finding; it is recorded here for completeness. `npm approve-scripts --allow-scripts-pending` reviews them.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

`project_name: subtracker` is likewise metadata only — the scaffold landed in the current working directory, so the directory name is the user's choice and `project_name` was not used as a directory name.

Note: the starter shipped `.github/workflows/ci.yml` as part of its own file set, and it moved up cleanly because the repo had no such file. That is the starter's content passing through the conflict matrix, not bootstrapper acting on `ci_provider` — v1 generates no CI files of its own.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history. This repo already has a `.git/`, so there is nothing to do.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep. The load-bearing ones here are `package.json.scaffold`, `tsconfig.json.scaffold`, and `eslint.config.js.scaffold` — the moved-up Astro sources (`astro.config.mjs`, `src/pages/**`, `src/components/**`) expect the starter's versions of those three, so the project will not build against the repo's existing minimal config until you merge or swap them.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. There are none.
