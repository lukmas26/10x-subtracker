# CI Workflow Enhancements — Plan Brief

> Full plan: `context/changes/cicd-workflow-enhancements/plan.md`
> Research: `context/changes/cicd-workflow-enhancements/research.md`

## What & Why

The CI checks are strong (lint, UI tokens, type check, build, types drift, RLS, smoke) but nothing enforces them: `master` has no protection, so a red PR can merge. We make CI blocking and close the hygiene gaps — formatting outside ESLint, dependency advisories, mutable action tags, missing permissions/concurrency/timeouts.

## Starting Point

`.github/workflows/ci.yml` runs two jobs, `ci` and `smoke`, on push/PR to `master`, using floating `@v4`/`@v1` tags and hard-coded Node 22. No branch protection or ruleset, no Dependabot, no audit step, no `prettier --check` in CI (17 files drift, all in `context/` and `.agents/`). `npm audit`: 7 high, 0 critical.

## Desired End State

A PR to `master` cannot merge unless `ci` and `smoke` are green and the branch is up to date. `ci` also fails on formatting drift and critical advisories. Actions are SHA-pinned and kept fresh by Dependabot, which also opens weekly npm update PRs. The rules are versioned in the repo and documented in `test-plan.md` §5 and AGENTS.md.

## Key Decisions Made

| Decision                    | Choice                                                                                                               | Why (1 sentence)                                                   | Source   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Enforcement mechanism       | Ruleset on `master`: PR required, `ci`+`smoke` required, strict up-to-date, no force-push/deletion, 0 approvals      | Enforces CI without blocking a solo author who cannot self-approve | Plan     |
| Format gate scope           | `prettier --check .` with `.prettierignore` for `context/`, `.agents/`, `supabase/.temp/`; YAML added to lint-staged | New files covered by default; green today without mass reformat    | Plan     |
| Audit threshold             | Blocking `npm audit --audit-level=critical`; highs worked down via Dependabot                                        | Green today, stops new critical advisories immediately             | Plan     |
| Action pinning              | Full commit SHAs at latest release + `# vX.Y.Z`; Dependabot `github-actions`                                         | Tags are mutable; Dependabot keeps SHAs fresh                      | Plan     |
| Who applies GitHub settings | Ruleset committed as JSON; agent applies via `gh api` after green `master` and user confirmation                     | Versioned, reproducible, correct ordering                          | Plan     |
| Hygiene defaults            | `contents: read`, cancel superseded PR runs only, timeouts 15/20 min, `workflow_dispatch`, `.nvmrc`                  | Standard best practice; no product trade-off                       | Plan     |
| `src/` test step            | Left to test-plan §3 Phase 4                                                                                         | Already owned by the test rollout                                  | Research |
| Job names / smoke behaviour | Unchanged                                                                                                            | Required-check contexts and safe-release contract depend on them   | Research |

## Scope

**In scope:** `ci.yml` hygiene and pinning, preview-start failure message, `.prettierignore`, `format:check` script, lint-staged YAML, CI format + audit steps, `.github/dependabot.yml`, `.github/rulesets/master.json`, test-plan §5 + AGENTS.md updates, applying the ruleset and Dependabot alerts.

**Out of scope:** `src/` tests, fixing the 7 high advisories, review approvals/CODEOWNERS/PR template/commitlint/coverage/CodeQL, deploy automation, job restructuring, reformatting `context/`, repo merge settings.

## Architecture / Approach

Config-only. Phases 1–3 land as one PR through the existing CI, so the hardened `ci`/`smoke` checks are proven green on `master`. Phase 4 then flips GitHub-side settings via `gh api` from the committed JSON — the only immediately outward-facing step, gated on user confirmation.

## Phases at a Glance

| Phase                         | What it delivers                                                                        | Key risk                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Workflow hygiene & pinning | permissions, concurrency, timeouts, dispatch, `.nvmrc`, SHA pins, clear preview failure | New action majors change inputs/defaults                                   |
| 2. Format & audit gates       | `.prettierignore`, `format:check`, CI format + `critical` audit                         | Audit depends on registry availability                                     |
| 3. Dependabot & docs          | `dependabot.yml`, ruleset JSON, test-plan §5, AGENTS.md                                 | Dependabot PRs have no secrets (build still works — Supabase env optional) |
| 4. Enforcement                | Ruleset applied, alerts on, red PR shown blocked                                        | A required check that never reports blocks every PR                        |

**Prerequisites:** `gh` authenticated with repo admin rights; Phases 1–3 merged and green on `master` before Phase 4.
**Estimated effort:** ~1–2 sessions across 4 phases (one PR + one settings session).

## Open Risks & Assumptions

- Latest action majors (checkout v7, setup-node v7, setup-cli v3) may change inputs; release notes are checked while pinning.
- A new critical advisory upstream would block all PRs until upgraded — intended behaviour.
- Renaming `ci`/`smoke` later requires updating and re-applying the ruleset in the same change.

## Success Criteria (Summary)

- A deliberately red PR shows `mergeStateStatus: BLOCKED`.
- `ci` fails on formatting drift and critical advisories; all current checks still pass.
- Dependabot opens grouped npm and Actions update PRs.
