---
date: 2026-10-15T13:01:08+02:00
researcher: Claude (claude-opus-5-5)
git_commit: cf3b646
branch: create-test-plan
repository: lukmas26/10x-subtracker (local: test-repo)
topic: "Does the GitHub CI workflow cover what keeps quality and consistency on every PR, per current best practice?"
tags: [research, ci, github-actions, quality-gates, branch-protection, supply-chain]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (claude-opus-5-5)
---

# Research: GitHub CI workflow vs. PR quality best practices

**Date**: 2026-10-15T13:01:08+02:00
**Researcher**: Claude (claude-opus-5-5)
**Git Commit**: cf3b646 (`.github/workflows/ci.yml` and `package.json` identical to `origin/master` `ca614da`)
**Branch**: create-test-plan
**Repository**: lukmas26/10x-subtracker

## Research Question

Review the current GitHub Actions CI workflow: does it contain the most important checks that keep quality on every PR, and does it follow best practices for quality and code consistency? (`change.md` Notes.)

## Summary

The **content** of the checks is strong for an MVP: lint (ESLint strict type-checked + Prettier-as-ESLint-rule), UI-token lint, matcher unit tests, `astro check`, production build, a generated-types drift diff, an RLS isolation check and an end-to-end smoke against the production preview (`ci.yml:18-61`). The last 8 runs all passed in 2m06s–2m24s (`gh run list`, 2026-10-13…14).

The gaps are in **enforcement and hygiene**, not in the checks themselves:

1. **Nothing makes CI blocking.** `master` has no branch protection and no rulesets (`GET …/branches/master/protection` → 404 "Branch not protected"; `GET …/rulesets` → `[]`). A red PR can be merged, and direct pushes to `master` are allowed.
2. **Formatting is checked only for ESLint-linted files.** `eslint-plugin-prettier` covers JS/TS/Astro (`eslint.config.js:4,105`), but CI never runs `prettier --check`, so JSON/CSS/MD/YAML drift is only caught by the pre-commit hook (`package.json` `lint-staged`), which can be bypassed.
3. **No dependency/supply-chain gate**: no `npm audit` step, no Dependabot config (`.github/` holds only `workflows/`), Dependabot alerts disabled (`GET …/vulnerability-alerts` → 404). Today `npm audit --omit=dev` reports 7 high, 0 critical.
4. **Workflow hygiene missing**: no `permissions:` block, no `concurrency:` cancel-in-progress, no `timeout-minutes`, actions pinned to floating major tags 2–3 majors behind latest, Node version hard-coded instead of `.nvmrc`.
5. **Test-plan gate still pending**: unit + integration tests for `src/` services are "required after §3 Phase 4" (`test-plan.md:117`, `:75`), so CI has no tests for application logic yet — by plan, not by omission.

## Detailed Findings

### What CI runs today (observed)

Triggers: `push` and `pull_request` on `master` only (`ci.yml:3-7`). Two independent jobs, no `needs` (`ci.yml:10,29`).

| Step                                                                             | Where                                  | Catches                                        |
| -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `npm ci` (lockfile-exact install)                                                | `ci.yml:18`, `:40`                     | lockfile drift                                 |
| `npx astro sync`                                                                 | `ci.yml:19`                            | prerequisite for lint                          |
| `npm run lint` (ESLint strictTypeChecked + stylisticTypeChecked + prettier rule) | `ci.yml:20`; `eslint.config.js:17,105` | type-aware lint errors, JS/TS/Astro formatting |
| `npm run lint:ui`                                                                | `ci.yml:21`                            | design-token literals in scoped views          |
| `npm run test:smoke` (`node --test scripts/*.test.mjs`)                          | `ci.yml:22`                            | matcher regressions                            |
| `npx astro check`                                                                | `ci.yml:23`                            | type errors in `.astro`/TS                     |
| `npm run build` with repo secrets                                                | `ci.yml:24-27`                         | build breakage                                 |
| local Supabase (CLI pinned 2.118.0)                                              | `ci.yml:37-44`                         | —                                              |
| `supabase gen types … \| diff`                                                   | `ci.yml:50-51`                         | migration ↔ checked-in types drift             |
| `npm run test:rls`                                                               | `ci.yml:52-55`                         | cross-account RLS access (risk #1)             |
| build + `preview` + `npm run smoke`                                              | `ci.yml:56-61`                         | auth / add / edit / isolation flows            |
| `supabase stop` under `if: always()`                                             | `ci.yml:62-63`                         | cleanup                                        |

This matches `test-plan.md` §5 rows 111–116 (all marked required); CI implements every gate the plan marks `required` today.

### Gap 1 — enforcement (highest leverage)

- No branch protection or ruleset on `master` (GitHub API, checked 2026-10-15). CI results are advisory.
- Repo settings: public, merge commits and squash both allowed, `delete_branch_on_merge: false` (`GET repos/lukmas26/10x-subtracker`).
- Best practice: a ruleset on `master` requiring PRs, the `ci` and `smoke` status checks, up-to-date branches, and blocking force-push/deletion. This is a repository setting, not workflow YAML.
- Job names `ci`/`smoke` are what a required-check rule would reference; renaming jobs later breaks the rule.

### Gap 2 — format consistency

- `eslint-plugin-prettier/recommended` is the last ESLint config (`eslint.config.js:105`), so `npm run lint` fails on Prettier drift in files ESLint lints (JS/TS/TSX/Astro/MJS).
- Files ESLint does not lint (JSON, CSS, MD, YAML) are formatted only by lint-staged on commit (`package.json` `"*.{json,css,md}": ["prettier --write"]`). YAML is not in that list at all.
- `npx prettier --check .` on this working tree (cf3b646 + local edits): 22 files differ. None are under `src/` or `scripts/`; 17 are under `context/`, 3 under `.agents/` (tool-managed), plus `CLAUDE.md` (locally modified, partly tool-managed) and `supabase/.temp/linked-project.json` (untracked, not in `.gitignore`). A whole-repo `prettier --check` gate would therefore fail immediately; it needs either a scoped path list or `.prettierignore` entries (`context/`, `.agents/`, `supabase/.temp/`) plus a one-time format.

### Gap 3 — dependency and supply-chain

- No `npm audit` step in either job (`ci.yml:12-27`, `:31-63`).
- `npm audit` (2026-10-15): 7 high, 0 critical. Packages: `wrangler` (direct, devDependency), `miniflare`, `@cloudflare/vite-plugin`, `undici`, `sharp`, `http-cache-semantics`, `source-map-js`. `--omit=dev` still reports 7 high because `@cloudflare/vite-plugin` arrives through the `@astrojs/cloudflare` runtime dependency. An `npm audit --audit-level=high` gate would fail today; `--audit-level=critical` would pass.
- No `.github/dependabot.yml`; Dependabot alerts disabled (API 404). Neither npm packages nor GitHub Actions versions get update PRs.

### Gap 4 — workflow hygiene

- **Token permissions**: no `permissions:` key (`ci.yml` whole file). The repo default is already `read` (`GET …/actions/permissions/workflow` → `default_workflow_permissions: read`), so the effective risk is low; an explicit `permissions: contents: read` makes it independent of repo settings.
- **Concurrency**: no `concurrency:` group; pushes to the same PR run in parallel to completion.
- **Timeouts**: no `timeout-minutes`; GitHub's default job limit is 360 min. Observed runtime is ≈2–2.5 min.
- **Action pinning**: `actions/checkout@v4`, `actions/setup-node@v4`, `supabase/setup-cli@v1` (`ci.yml:13-14,32-33,37`). Latest releases (GitHub API, 2026-10-15): checkout `v7.0.1`, setup-node `v7.1.0`, setup-cli `v3.0.1`. Tags are mutable; SHA pinning is not required by the repo (`sha_pinning_required: false`).
- **Node version**: `node-version: 22` in both jobs (`ci.yml:16,35`) while `.nvmrc` pins `22.14.0`; `node-version-file: .nvmrc` would keep local and CI in sync.
- **Duplication**: checkout + setup-node + `npm ci` repeated in both jobs; `npm run build` runs in both (`ci.yml:24`, `:56`).
- **Preview wait loop** (`ci.yml:59-61`): if the server never answers within 60 s the loop exits silently and smoke fails with connection errors rather than a clear "preview did not start" message. Minor.
- **No `workflow_dispatch`** trigger for manual re-runs on non-PR branches. Minor.

### Gap 5 — tests for application code (planned)

- CI has no unit/integration tests for `src/` (only `scripts/*.test.mjs`, `ci.yml:22`).
- `test-plan.md:117` marks "unit + integration for services" as `required after §3 Phase 4`; Phase 4 "Quality-gates wiring" is `not started` (`test-plan.md:75`). The runner for `src/` is chosen in test-plan Phase 2 research (`context/changes/testing-safety-net-verification/plan.md:36`).
- Implication for this change: adding a `src/` test step belongs to test-plan Phase 4, not here; this change can at most leave a slot for it.

### Not observed (inspected scope: `.github/`, `package.json`, repo API)

No PR template, no CODEOWNERS, no commit-message lint (commitlint), no coverage reporting, no deploy job (deploy is manual `npx wrangler deploy`, AGENTS.md), no CodeQL/secret-scanning workflow.

## Code References

- `.github/workflows/ci.yml:3-7` — triggers (push/PR on master)
- `.github/workflows/ci.yml:10-27` — `ci` job: install, sync, lint, lint:ui, test:smoke, astro check, build
- `.github/workflows/ci.yml:29-63` — `smoke` job: local Supabase, types diff, RLS, build, preview smoke, cleanup
- `.github/workflows/ci.yml:13-14,32-33,37` — floating action tags
- `.github/workflows/ci.yml:16,35` — hard-coded Node 22 (vs `.nvmrc` 22.14.0)
- `eslint.config.js:4,105` — Prettier enforced through ESLint
- `package.json` `lint-staged` — pre-commit: eslint --fix + ui-literals on TS/Astro; prettier --write on JSON/CSS/MD
- `.husky/pre-commit` — `npx lint-staged`
- `context/foundation/test-plan.md:103-119` — §5 Quality Gates
- `context/foundation/test-plan.md:75` — §3 Phase 4 "Quality-gates wiring", not started

## Architecture Insights

- The split is deliberate: `ci` is fast and secret-free in spirit (secrets only for build), `smoke` owns everything needing a database. Keeping the two job names stable matters once they become required checks.
- Local-first quality (husky + lint-staged) mirrors CI, but CI is the only non-bypassable layer — which is why enforcement (Gap 1) outweighs adding more steps.
- `test-plan.md` §5 is the contract for which gates are required. New gates added here (format, audit) should be recorded there so the two don't drift.

## Historical Context (from prior changes)

- `context/archive/2026-10-02-first-subscription-on-list/reviews/impl-review.md` F5 — the types-drift diff (`ci.yml:50-51`) was added from an implementation review; supported, still present.
- `context/archive/2026-09-30-safe-release-verification/plan.md:13` — smoke job "must keep working unchanged in behaviour"; any restructuring here must preserve smoke behaviour.
- `context/archive/2026-10-06-ui-tokens-onboarding/plan.md:402` — added `lint:ui` to CI and lint-staged.
- Commit `5c2f3e5` — pinned the Supabase CLI version in CI (precedent for pinning).
- `context/foundation/infrastructure.md:277` — CI/CD pipeline setup was explicitly out of scope of infra research; deploy is not automated.
- `context/foundation/roadmap.md:71` — "CI runs lint, type-check, build, and a smoke test"; supported, but now incomplete (also lint:ui, test:smoke, types diff, RLS).

## Related Research

- `context/changes/testing-safety-net-verification/research.md` — test-plan Phase 1; touches CI only as consumer (`ci.yml:22,52-61`).

## Open Questions (product choices for /10x-plan)

1. **Branch protection**: classic protection or a ruleset; require reviews on a solo repo or only status checks? (Settings change via `gh api` or UI, outside the YAML.)
2. **Format gate scope**: `prettier --check` on code/config paths only, or whole repo with `.prettierignore` for `context/` and `.agents/` plus a one-time reformat?
3. **Audit threshold**: `critical` (passes today) vs `high` (fails today until `wrangler`/`@astrojs/cloudflare` are upgraded or advisories triaged); blocking vs informational.
4. **Action pinning**: bump to latest majors on tags, or pin to commit SHAs with Dependabot (`github-actions` ecosystem) keeping them fresh?
5. **Lesson boundary**: CLAUDE.md says CI/CD authoring is owned by Module 1 L5 / Module 2 L5 and test-plan Phase 4 wires the `src/` test gate. Confirm this change edits `ci.yml` directly and leaves the `src/` test step to Phase 4.
