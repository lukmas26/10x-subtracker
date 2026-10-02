<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Safe Release Verification

- **Plan**: context/changes/safe-release-verification/plan.md
- **Mode**: Deep
- **Date**: 2026-10-01
- **Verdict**: REVISE → SOUND after triage (all findings fixed in plan)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding
6/6 paths ✓, 5/5 symbols ✓ (smoke.mjs:66 startsWith, request() helper, enable_confirmations, scriptsConfig, ci smoke job), brief↔plan ✓, Progress↔Phase 19/19 ✓

## Findings

### F1 — `node --test scripts/` fails outright

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §4 — Test script and CI
- **Detail**: Verified on Node 24: a directory argument to `node --test` errors with "Cannot find module '…\scripts'". The planned `test:smoke` script would fail from the first run.
- **Fix**: `"test:smoke": "node --test \"scripts/*.test.mjs\""` — the quoted glob also keeps the network-calling `smoke.mjs` out of the test run.
- **Decision**: FIXED

### F2 — Preview upload without a build

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 runbook, §3 live verification
- **Detail**: `wrangler.jsonc` has no build command, so `wrangler versions upload` ships the existing `dist/` as-is; a stale build would be previewed and later promoted as the verified version.
- **Fix**: Runbook and Phase 3 run `npm run build` before `npx wrangler versions upload`.
- **Decision**: FIXED

### F3 — `URL` is not a declared global for scripts/*.mjs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1 — Redirect matcher module
- **Detail**: `eslint.config.js` `scriptsConfig` declares only console/process/fetch/URLSearchParams with `no-undef` active; the matcher's `new URL()` would fail `npm run lint`.
- **Fix**: Phase 1 §5 adds `URL: true` to `scriptsConfig` globals.
- **Decision**: FIXED

### F4 — "CI green on the pushed branch" needs a push nobody authorized

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (1.4), Phase 2 (2.4)
- **Detail**: Phase gates depended on CI results, but pushing `master` is an outward action requiring explicit approval.
- **Fix**: Gates are the local 8/8 run (local Supabase + build + preview + smoke); CI re-confirms only after a user-requested push.
- **Decision**: FIXED

### F5 — Runbook commands are POSIX-only

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2 — Release runbook
- **Detail**: `BASE_URL=… npm run smoke:remote` does not work in PowerShell, the workstation's primary shell.
- **Fix**: Runbook shows both POSIX and PowerShell (`$env:…`) forms, including clearing `SMOKE_EXPECT_ACCESS` before the production run.
- **Decision**: FIXED
