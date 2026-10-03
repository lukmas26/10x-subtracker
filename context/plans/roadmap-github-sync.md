# Sync roadmap.md → GitHub issues (one-off)

## Context

`context/foundation/roadmap.md` (M-1, 7 items: F-01, S-01–S-06) was just generated. Its `## Backlog Handoff` table is meant to be the handoff into a backlog tool. Repo `lukmas26/10x-subtracker` currently has **zero issues**, only GitHub's default labels, and `gh` is authenticated as `lukmas26`. The user chose: one-off `gh` commands (no script), a GitHub milestone plus labels, and issue numbers written back into roadmap.md.

## Steps

0. Copy this plan to `context/plans/roadmap-github-sync.md`, following the repo convention that plans live in the repo.
1. **Labels** (`gh label create`, skip any that already exist):
   - `roadmap`
   - `foundation`, `slice`
   - `status:ready`, `status:proposed`, `status:blocked` (only the statuses in use today)
2. **GitHub milestone**: `gh api repos/lukmas26/10x-subtracker/milestones -f title="M-1: MVP — from the first subscription to the first savings recommendation" -f description="milestone_id: mvp-first-savings-recommendation. Outcome-scoped, no due date. Source: context/foundation/roadmap.md"`. **No due date**, because roadmaps don't carry dates.
3. **Issues** (7), created in dependency order (F-01, S-01, S-02, S-03, S-04, S-05, S-06) so the issues they depend on already have numbers:
   - **Title:** `[<ID>] <Suggested issue title>` from Backlog Handoff, e.g. `[S-01] Add the first subscription and show the subscription list`.
   - **Labels:** `roadmap`, `foundation` or `slice`, and `status:<Status>`. S-05 gets `status:blocked`.
   - **Milestone:** M-1.
   - **Body:** written to a scratchpad file and passed with `--body-file`. It holds:
     - Outcome
     - `Change ID: <id>`, which is the stable match key
     - PRD refs
     - Prerequisites, written as `Depends on #N` for roadmap IDs
     - Parallel with
     - Unlocks (F-01 only)
     - Unknowns, with Owner and Block
     - Risk
     - Next step: `/10x-plan <change-id>` when ready
     - A footer: "Source: context/foundation/roadmap.md — edit the roadmap, not this issue."
   - Before creating each issue, check that no issue with that title already exists, so an interrupted run doesn't create duplicates.
4. **Write-back** to `context/foundation/roadmap.md`:
   - In `## Backlog Handoff`, add `#N` at the start of each row's Notes cell, e.g. `#2 — Run /10x-plan first-subscription-on-list`.
   - No new columns or sections, so the skill's section and column contract stays intact.
   - No other edits; `updated` stays 2026-09-28.

## Critical files
- `context/foundation/roadmap.md`: the source, plus the Notes write-back
- Scratchpad: temporary issue body files, not committed

## Not in scope
- No commit or push. The roadmap edit stays in the working tree for you to review.
- Future status flips from `/10x-plan`, `/10x-implement` and `/10x-archive` have to be mirrored to the issues by hand, since you chose a one-off sync.

## Verification
- `gh issue list --milestone "M-1: …" --state all` shows exactly 7 issues with the right titles.
- `gh issue list --label status:blocked` shows only `[S-05]`.
- `gh issue list --label status:ready` shows `[F-01]` and `[S-01]`.
- `gh issue view <n>` on S-05 shows `Depends on #<S-01>, #<S-04>` and the blocking unknown.
- `git diff context/foundation/roadmap.md` shows only the 7 Notes cells changed.
