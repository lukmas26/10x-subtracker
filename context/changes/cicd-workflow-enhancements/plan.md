# CI Workflow Enhancements Implementation Plan

## Overview

Turn the existing GitHub Actions CI from advisory into an enforced, hardened PR gate. The checks themselves are already strong; this plan adds the missing hygiene (permissions, concurrency, timeouts, immutable action pins, Node from `.nvmrc`), two new gates (repo-wide Prettier check, blocking `npm audit` at `critical`), Dependabot for npm and Actions, and finally a versioned `master` ruleset that makes `ci` and `smoke` required.

## Current State Analysis

- `.github/workflows/ci.yml:3-7` — triggers on `push`/`pull_request` to `master`; no `workflow_dispatch`.
- `.github/workflows/ci.yml:10-27` — job `ci`: `npm ci`, `astro sync`, `lint`, `lint:ui`, `test:smoke`, `astro check`, `build` (with repo secrets).
- `.github/workflows/ci.yml:29-63` — job `smoke`: local Supabase (CLI 2.118.0), generated-types diff, `test:rls`, build, preview + `npm run smoke`, `supabase stop` under `always()`.
- No `permissions:`, `concurrency:` or `timeout-minutes` anywhere in the file.
- `ci.yml:13-14,32-33,37` — `actions/checkout@v4`, `actions/setup-node@v4`, `supabase/setup-cli@v1` on mutable tags, 2–3 majors behind (latest per research: checkout v7.0.1, setup-node v7.1.0, setup-cli v3.0.1).
- `ci.yml:16,35` — `node-version: 22` while `.nvmrc` pins `22.14.0`.
- `ci.yml:59-61` — the preview wait loop exits silently after 60 s; smoke then fails with connection errors instead of a clear message.
- Formatting: Prettier is enforced only through ESLint (`eslint.config.js:105`) for JS/TS/Astro. JSON/CSS/MD go through lint-staged (`package.json` `lint-staged`), YAML not at all, and CI never runs `prettier --check`. `npx prettier --check .` today flags 17 files, all under `context/` and `.agents/` (verified on this worktree 2026-10-15). `.prettierignore` exists and lists only `src/db/database.types.ts`.
- Dependencies: no audit step; `npm audit` reports 7 high / 0 critical (`wrangler`, `@astrojs/cloudflare` → `@cloudflare/vite-plugin`, `miniflare`, `undici`, `sharp`, …). No `.github/dependabot.yml`; Dependabot alerts disabled.
- Enforcement: `master` has no branch protection and no rulesets — red PRs can merge, direct pushes are allowed.
- `context/foundation/test-plan.md` §5 is the contract of which gates are required; AGENTS.md `## Commands` / `## CI` describe CI to agents.

## Desired End State

- Every PR to `master` runs `ci` and `smoke`; both are **required** by a ruleset on `master`, branches must be up to date, force-push and deletion are blocked, no review approval is required.
- `ci` additionally fails on any Prettier drift outside ignored paths and on any `critical` npm advisory.
- Actions are pinned to full commit SHAs with a version comment; Node comes from `.nvmrc`; the workflow has read-only token permissions, per-job timeouts, superseded PR runs cancelled, and can be started manually.
- Dependabot opens weekly grouped update PRs for npm and GitHub Actions, and alerts/security updates are on.
- The ruleset lives in `.github/rulesets/master.json`, and `test-plan.md` §5 + AGENTS.md list the new gates.

Verification: a throwaway PR with a deliberate lint error shows `mergeStateStatus: BLOCKED`; `gh api repos/lukmas26/10x-subtracker/rulesets` returns the committed ruleset.

### Key Discoveries:

- Job names `ci` and `smoke` are the status-check contexts the ruleset references — they must not be renamed (`ci.yml:10,29`).
- Smoke must keep working unchanged in behaviour (`context/archive/2026-09-30-safe-release-verification/plan.md:13`).
- `SUPABASE_URL`/`SUPABASE_KEY` are `optional` in `astro.config.mjs` `env.schema`, so the `ci` build passes without secrets — this matters for Dependabot PRs, which do not receive repo Actions secrets.
- The repo default workflow token is already `read`; the explicit block makes it independent of repo settings.
- Commit `5c2f3e5` pinned the Supabase CLI version — precedent for pinning.

## What We're NOT Doing

- No `src/` unit/integration test step — that is test-plan §3 Phase 4 ("Quality-gates wiring").
- No dependency upgrades to clear the 7 high advisories — Dependabot PRs handle them after this change.
- No required review approvals, CODEOWNERS, PR template, commitlint, coverage reporting, CodeQL workflow.
- No automated deploy job.
- No restructuring of the two jobs (shared build, `needs`, reusable workflows) and no change to the smoke steps beyond the preview-start failure message.
- No reformat of `context/` or `.agents/` — they are ignored by Prettier.
- No change to repo merge settings (merge vs squash, `delete_branch_on_merge`).

## Implementation Approach

Ship the YAML/config changes first (Phases 1–3) on one branch through a normal PR, so the hardened `ci` and `smoke` checks are green on `master` before anything becomes required. Only then (Phase 4), with explicit user confirmation, apply the committed ruleset and enable Dependabot alerts via `gh api` — the only steps with immediate outward effect.

## Critical Implementation Details

**Ordering:** the ruleset must be applied only after the Phase 1–3 workflow has run green on `master`; a required check that has never reported (or whose name changed) blocks every PR. Phase 4's GitHub-side steps need user confirmation at the time they run, and a `gh` token with repo admin rights.

**SHA resolution:** resolve each action's latest release tag to the commit SHA (dereference annotated tags: `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, then `git/tags/<sha>` if `object.type` is `tag`), and write it as `uses: owner/repo@<40-char-sha> # vX.Y.Z` so Dependabot can bump it. Check each new major's release notes for input changes (e.g. `setup-node` caching defaults, `setup-cli` `version` input) before bumping.

---

## Phase 1: Workflow hygiene & pinning

### Overview

Harden `.github/workflows/ci.yml` without changing what the checks verify.

### Changes Required:

#### 1. Workflow-level settings

**File**: `.github/workflows/ci.yml`

**Intent**: Add a manual trigger, least-privilege token, and cancellation of superseded PR runs (never of `master` runs).

**Contract**: `on:` gains `workflow_dispatch:`. Top-level `permissions: { contents: read }`. Top-level `concurrency:` with `group: ${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.

#### 2. Per-job settings

**File**: `.github/workflows/ci.yml`

**Intent**: Bound runtime (observed ≈2–2.5 min) and keep Node in sync with local development.

**Contract**: `ci` gets `timeout-minutes: 15`, `smoke` gets `timeout-minutes: 20`. Both `setup-node` steps replace `node-version: 22` with `node-version-file: .nvmrc`, keeping `cache: npm`. Job ids `ci` and `smoke` unchanged.

#### 3. Action pinning

**File**: `.github/workflows/ci.yml`

**Intent**: Replace mutable tags with immutable SHAs at the latest release.

**Contract**: `actions/checkout`, `actions/setup-node`, `supabase/setup-cli` each `@<full sha> # v<latest>`. Supabase CLI `version: 2.118.0` input stays.

#### 4. Preview start failure

**File**: `.github/workflows/ci.yml` (step "Run smoke test against production preview")

**Intent**: If the preview never answers within the existing 60 s window, fail the step with a clear "preview did not start" error instead of running smoke against a dead port.

**Contract**: Same port, same 60 × 1 s polling, same `BASE_URL=http://localhost:4321 npm run smoke` call when the server is up; on timeout print an error (GitHub `::error::` annotation) and `exit 1` before smoke.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check .github/workflows/ci.yml` passes
- No action reference in `ci.yml` uses a tag: `grep -E 'uses: [^@]+@v' .github/workflows/ci.yml` returns nothing
- Job ids are still exactly `ci` and `smoke`
- `ci` and `smoke` both pass on the PR

#### Manual Verification:

- PR run log shows Node 22.14.0 in setup-node and both jobs have the timeout set
- Pushing a second commit to the PR cancels the first run

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Format & audit gates

### Overview

Add a repo-wide Prettier gate and a blocking `critical` audit gate to `ci`; both pass on the current tree.

### Changes Required:

#### 1. Prettier ignore

**File**: `.prettierignore`

**Intent**: Exclude agent/planning docs and tool state so a whole-repo check is green without mass reformatting.

**Contract**: Keep `src/db/database.types.ts`; add `context/`, `.agents/`, `supabase/.temp/`. (Prettier already skips `.gitignore`d paths such as `dist/`, `node_modules/`.)

#### 2. Scripts and lint-staged

**File**: `package.json`

**Intent**: Give CI and humans one command for the format check, and format YAML on commit too.

**Contract**: New script `"format:check": "prettier --check ."`. lint-staged glob `"*.{json,css,md}"` becomes `"*.{json,css,md,yml,yaml}"`.

#### 3. CI steps

**File**: `.github/workflows/ci.yml` (job `ci`)

**Intent**: Fail PRs on formatting drift and on critical advisories.

**Contract**: After `npm ci`: a step running `npm audit --audit-level=critical`; after `npm run lint`: a step running `npm run format:check`. No changes to job `smoke`.

### Success Criteria:

#### Automated Verification:

- `npm run format:check` passes locally
- `npm audit --audit-level=critical` exits 0 locally
- `npm run lint` and `npm run lint:ui` pass
- `ci` and `smoke` pass on the PR

#### Manual Verification:

- Temporarily mis-formatting a YAML or JSON file locally makes `npm run format:check` fail with that file named (revert afterwards)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dependabot & docs

### Overview

Keep npm packages and pinned Actions fresh automatically, and record the new gates where agents and the test plan look for them.

### Changes Required:

#### 1. Dependabot config

**File**: `.github/dependabot.yml` (new)

**Intent**: Weekly update PRs for both ecosystems, grouped to limit noise.

**Contract**: `version: 2`; `updates` for `package-ecosystem: npm` (directory `/`) and `package-ecosystem: github-actions` (directory `/`), both `schedule.interval: weekly`. npm groups minor+patch updates into one PR (majors separate); github-actions groups all updates into one PR. Must pass `format:check`.

#### 2. Ruleset definition (file only — applied in Phase 4)

**File**: `.github/rulesets/master.json` (new)

**Intent**: Version the branch rules so they can be reviewed in the PR and re-applied reproducibly.

**Contract**: Shape accepted by `POST /repos/{owner}/{repo}/rulesets`. Non-obvious parts — the required-check contexts must equal the job ids and be tied to the GitHub Actions app:

```json
{
  "name": "master",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "ci", "integration_id": 15368 },
          { "context": "smoke", "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

No `bypass_actors` (admin can still edit or disable the ruleset in an emergency).

#### 3. Test plan gates

**File**: `context/foundation/test-plan.md` (§5 Quality Gates table)

**Intent**: Keep §5 the single contract for gates.

**Contract**: New rows — "format (`format:check`) | pre-commit (lint-staged) + CI | required | formatting drift"; "dependency audit (`npm audit --audit-level=critical`) | CI | required | critical advisories"; and a note under the table that `ci` and `smoke` are enforced on `master` by `.github/rulesets/master.json`.

#### 4. Agent guidance

**File**: `AGENTS.md` (`## Commands`, `## CI`)

**Intent**: Agents learn the new command and that CI is now enforced.

**Contract**: `## Commands` gains `npm run format:check`. `## CI` states: jobs `ci`/`smoke` are required checks on `master` (ruleset in `.github/rulesets/master.json`, never rename the jobs); actions are SHA-pinned and bumped by Dependabot; Node version comes from `.nvmrc`. Do not edit `CLAUDE.md`.

### Success Criteria:

#### Automated Verification:

- `npm run format:check` passes (covers the new YAML/JSON files)
- `node -e "JSON.parse(require('fs').readFileSync('.github/rulesets/master.json','utf8'))"` succeeds
- `ci` and `smoke` pass on the PR

#### Manual Verification:

- Reviewer reads the ruleset JSON and dependabot.yml in the PR diff and agrees with them
- PR with Phases 1–3 is merged to `master` and the post-merge `push` run of `ci` and `smoke` is green

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Enforcement

### Overview

Apply the GitHub-side settings. Every step here takes effect immediately on the public repo, so each runs only after the user confirms it in the session.

### Changes Required:

#### 1. Apply the ruleset

**File**: none (GitHub API) — source `.github/rulesets/master.json`

**Intent**: Make `ci` and `smoke` required on `master`.

**Contract**: Precondition: Phase 3 merged and its `master` run green. `gh api -X POST repos/lukmas26/10x-subtracker/rulesets --input .github/rulesets/master.json` (or `PUT …/rulesets/<id>` if a ruleset named `master` already exists).

#### 2. Enable Dependabot alerts and security updates

**File**: none (GitHub API)

**Intent**: Surface the existing high advisories and let Dependabot open security fix PRs.

**Contract**: `gh api -X PUT repos/lukmas26/10x-subtracker/vulnerability-alerts` then `gh api -X PUT repos/lukmas26/10x-subtracker/automated-security-fixes`.

#### 3. Prove enforcement

**File**: none — throwaway branch

**Intent**: Show that a red PR cannot merge, then clean up.

**Contract**: Push a branch with a deliberate lint error, open a draft PR, wait for `ci` to fail, check `gh pr view <n> --json mergeStateStatus` reports `BLOCKED`; then close the PR and delete the branch.

### Success Criteria:

#### Automated Verification:

- `gh api repos/lukmas26/10x-subtracker/rulesets` lists an active ruleset named `master`
- `gh api repos/lukmas26/10x-subtracker/vulnerability-alerts` returns 204
- Throwaway red PR reports `mergeStateStatus` `BLOCKED`

#### Manual Verification:

- GitHub UI on the throwaway PR shows the merge button disabled with `ci` required
- Dependabot opened its first update PRs (npm and github-actions) and their checks run
- Throwaway PR closed and branch deleted

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- None new — no application code changes. Existing `npm run test:smoke` keeps running in CI.

### Integration Tests:

- The PR itself is the integration test: `ci` and `smoke` must pass with the new steps; smoke behaviour unchanged.

### Manual Testing Steps:

1. Push two commits quickly to the PR — the first run is cancelled.
2. Locally break formatting in a JSON/YAML file — `npm run format:check` fails; revert.
3. After Phase 4, open a red throwaway PR — merge is blocked.

## Performance Considerations

`npm audit` and `prettier --check .` add a few seconds to `ci`; concurrency cancellation saves runner minutes on rapid pushes. Timeouts cap a hung job at 15/20 min instead of 360.

## Migration Notes

Rollback: YAML/config changes revert with a normal PR. The ruleset is removed with `gh api -X DELETE repos/lukmas26/10x-subtracker/rulesets/<id>` (or disabled in Settings → Rules). If a job is ever renamed, update `.github/rulesets/master.json` and re-apply it in the same change.

## References

- Related research: `context/changes/cicd-workflow-enhancements/research.md`
- Workflow: `.github/workflows/ci.yml:1-63`
- Quality-gate contract: `context/foundation/test-plan.md` §5 (Quality Gates), §3 Phase 4
- Smoke must stay unchanged: `context/archive/2026-09-30-safe-release-verification/plan.md:13`
- Prettier via ESLint: `eslint.config.js:105`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Workflow hygiene & pinning

#### Automated

- [x] 1.1 `npx prettier --check .github/workflows/ci.yml` passes — 69011bc
- [x] 1.2 No action reference in `ci.yml` uses a tag — 69011bc
- [x] 1.3 Job ids are still exactly `ci` and `smoke` — 69011bc
- [x] 1.4 `ci` and `smoke` both pass on the PR — 69011bc

#### Manual

- [x] 1.5 PR run log shows Node 22.14.0 and both jobs have the timeout set — 69011bc
- [x] 1.6 Pushing a second commit to the PR cancels the first run — 69011bc

### Phase 2: Format & audit gates

#### Automated

- [x] 2.1 `npm run format:check` passes locally — b94d5a3
- [x] 2.2 `npm audit --audit-level=critical` exits 0 locally — b94d5a3
- [x] 2.3 `npm run lint` and `npm run lint:ui` pass — b94d5a3
- [x] 2.4 `ci` and `smoke` pass on the PR — b94d5a3

#### Manual

- [x] 2.5 Mis-formatting a YAML or JSON file makes `npm run format:check` fail with that file named — b94d5a3

### Phase 3: Dependabot & docs

#### Automated

- [x] 3.1 `npm run format:check` passes (covers the new YAML/JSON files) — 22929fb
- [x] 3.2 `.github/rulesets/master.json` parses as JSON — 22929fb
- [x] 3.3 `ci` and `smoke` pass on the PR — 22929fb

#### Manual

- [x] 3.4 Reviewer agrees with the ruleset JSON and dependabot.yml in the PR diff — 22929fb
- [ ] 3.5 PR with Phases 1–3 merged and the post-merge `master` run is green

### Phase 4: Enforcement

#### Automated

- [ ] 4.1 `gh api …/rulesets` lists an active ruleset named `master`
- [ ] 4.2 `gh api …/vulnerability-alerts` returns 204
- [ ] 4.3 Throwaway red PR reports `mergeStateStatus` `BLOCKED`

#### Manual

- [ ] 4.4 GitHub UI on the throwaway PR shows the merge button disabled with `ci` required
- [ ] 4.5 Dependabot opened its first update PRs and their checks run
- [ ] 4.6 Throwaway PR closed and branch deleted
