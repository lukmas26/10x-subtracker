---
project: SubTracker
version: 1
status: draft
created: 2026-09-28
updated: 2026-10-01
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: mvp-first-savings-recommendation
milestone_seq: 1
milestone_status: open
---

# Roadmap: SubTracker

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: MVP — from the first subscription to the first savings recommendation** — Status: open

- **Intent:** A signed-in user keeps their own subscription register (adds, corrects, removes entries), sees the monthly and yearly total of their commitments, and gets a savings recommendation when one category holds more than one subscription — with the data visible only to the account owner.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001, FR-002, FR-003, FR-004, FR-006, FR-007 (all must-have requirements); US-01, US-02; the non-functional requirements on privacy, no data loss, fast action confirmation, and browser support. FR-005, FR-008, FR-009 (nice-to-have) are outside this milestone — see `## Parked`.

## Vision recap

People who pay by card for many recurring subscriptions lose track of them: amounts are small and renewals are automatic, so duplicates and unused services go unnoticed. A card statement shows transactions that have already happened; SubTracker shows commitments — what will keep being charged, totalled and grouped. What sets the product apart from a plain spreadsheet is the recommendation: pointing at a specific subscription to cancel or replace when one category holds more than one.

## North star

**S-01: User adds their first subscription and sees it on the list** — this is literally the PRD's primary success criterion, and with "speed to launch" as the goal what matters is getting the full sign-in → save → list flow working as early as possible.

> "North star" here means the smallest end-to-end flow whose delivery proves the product works — which is why it sits as early as its dependencies allow: everything else only matters if this flow works.

## At a glance

| ID   | Change ID                          | Outcome (user can …)                                                                     | Prerequisites | PRD refs                                                                                              | Status   |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| F-01 | safe-release-verification          | (foundation) releases carrying financial data can be safely verified before promotion   | —             | FR-001, NFR (financial data privacy), Success Criteria → Guardrails                                   | in-progress |
| S-01 | first-subscription-on-list         | add a first subscription (name, amount, cycle, category) and see it on the list          | —             | US-01, FR-001, FR-002, NFR (financial data privacy), NFR (fast action confirmation), NFR (desktop and mobile browsers) | ready    |
| S-02 | edit-subscription                  | correct an existing subscription without risking data loss                               | S-01          | FR-003, NFR (no data loss), NFR (fast action confirmation)                                            | proposed |
| S-03 | delete-subscription                | delete a subscription they no longer pay for                                             | S-01          | FR-004, Success Criteria → Guardrails (no data loss without user action)                              | proposed |
| S-04 | spending-summary                   | see the monthly and yearly total of all their subscriptions                              | S-01          | FR-006                                                                                                | proposed |
| S-05 | duplicate-category-recommendation  | see a savings recommendation for a duplicated category next to the summary               | S-01, S-04    | US-02, FR-007                                                                                         | blocked  |
| S-06 | dismiss-recommendation             | dismiss a recommendation so that it does not come back                                   | S-05          | US-02, FR-007                                                                                         | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                    | Note                                                                                   |
| ------ | ----------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| A      | Safe releases           | `F-01`                   | Standalone track, parallel to everything; must close before S-01's first promotion.    |
| B      | Subscription register   | `S-01` → `S-02` → `S-03` | North star at the head; S-02 and S-03 can run in parallel once S-01 lands.             |
| C      | Summary and savings     | `S-04` → `S-05` → `S-06` | Joins Stream B at S-01; S-05 waits on the savings-rule decision.                       |

## Baseline

What's already in place in the codebase as of `2026-09-28` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — web app shell with UI components and styling (`package.json`, `src/components/`, `src/layouts/Layout.astro`).
- **Backend / API:** partial — only authentication routes exist (`src/pages/api/auth/`); no domain logic at all.
- **Data:** partial — database provider configured (`supabase/config.toml`, `src/lib/supabase.ts`), but no migrations, tables, or row-level access policies.
- **Auth:** present — email + password sign-in with a cookie session and route protection (`src/middleware.ts`). No user/admin role model. The full sign-up → confirm → sign-in round trip against the production database is unverified (`context/plans/deployment-plan.md`, "Still unverified").
- **Deploy / infra:** present — the app runs in production, database secrets wired on 2026-09-26, CI runs lint, type-check, build, and a smoke test (`.github/workflows/ci.yml`, `scripts/smoke.mjs`). Still open: deployment previews are publicly accessible, and the smoke test's redirect assertion is too weak.
- **Observability:** partial — only platform invocation logs (`wrangler.jsonc` → `observability.enabled`) and live log tailing; no error tracking.

## Foundations

### F-01: Safe verification of releases carrying financial data

- **Outcome:** (foundation) deployment previews are not publicly accessible (or point at a separate database), and the smoke test can run the full sign-up → sign-in → protected page round trip against the production database without letting wrong redirects pass.
- **Change ID:** safe-release-verification
- **PRD refs:** FR-001, NFR (financial data privacy), Success Criteria → Guardrails
- **Unlocks:** the verification path for S-01 on preview and production before promotion (the first release that stores real financial data); the same path serves the S-02–S-06 releases.
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Protect previews, or give previews a separate database? — Owner: user. Block: no.
- **Risk:** Without this, S-01's first preview exposes real amounts publicly, and the smoke test reports success where sign-in actually failed. It is not a prerequisite for planning S-01, only for promoting it safely — so it runs in parallel rather than ahead of the north star.
- **Status:** in-progress

## Slices

### S-01: User adds their first subscription and sees it on the list

- **Outcome:** user can, once signed in, add a subscription (name, amount, monthly/yearly cycle, a category picked from a list or created on the spot) and immediately see it on their own subscription list — visible only to them.
- **Change ID:** first-subscription-on-list
- **PRD refs:** US-01, FR-001, FR-002, NFR (financial data privacy), NFR (fast action confirmation), NFR (desktop and mobile browsers)
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - One currency for all amounts (e.g. PLN), or a currency per subscription? — Owner: user. Block: no (default: a single currency).
  - Where does the initial category list come from, given that the admin-curated shared catalog (FR-005) is parked? — Owner: user. Block: no (default: a short starter list + the user's own categories).
- **Risk:** The first table holding financial data and the first row-level access policies are born here — a cross-account isolation bug is the most expensive possible bug, so the slice must explicitly verify that a second account cannot see someone else's subscriptions.
- **Status:** ready

### S-02: User edits a subscription

- **Outcome:** user can change the name, amount, cycle, or category of an existing subscription and see a save confirmation, and a failed save does not wipe the previous data.
- **Change ID:** edit-subscription
- **PRD refs:** FR-003, NFR (no data loss), NFR (fast action confirmation)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The main risk is a partial write on a dropped connection; the slice is small, so it is easy to verify against exactly that.
- **Status:** proposed

### S-03: User deletes a subscription

- **Outcome:** user can delete a subscription they no longer pay for and see that it — and only it — is gone from the list.
- **Change ID:** delete-subscription
- **PRD refs:** FR-004, Success Criteria → Guardrails (no data loss without user action)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04, F-01
- **Blockers:** —
- **Unknowns:**
  - Does deletion need a confirmation step or an undo? — Owner: user. Block: no.
- **Risk:** Deleting the wrong entry breaks the "data does not disappear without user action" guardrail; hence a separate slice rather than a footnote to editing.
- **Status:** proposed

### S-04: User sees the spending summary

- **Outcome:** user can open the summary screen and see the monthly and yearly total of all their subscriptions, with monthly and yearly cycles normalized to a common unit.
- **Change ID:** spending-summary
- **PRD refs:** FR-006
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03, F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Misleading totals with mixed cycles (the PRD calls this out explicitly) — cycle normalization must be checked against worked examples. This screen is also where the recommendation will appear, so it comes before S-05.
- **Status:** proposed

### S-05: User sees a savings recommendation for a duplicated category

- **Outcome:** user can, on the summary screen, see for every category with at least two subscriptions a recommendation naming a specific subscription to cancel or replace, together with the possible savings amount; a single subscription in a category never produces a recommendation.
- **Change ID:** duplicate-category-recommendation
- **PRD refs:** US-02, FR-007
- **Prerequisites:** S-01, S-04
- **Parallel with:** S-02, S-03, F-01
- **Blockers:** —
- **Unknowns:**
  - Which subscription in the group should be named, and how is the savings amount computed? For "cancel" it can be derived from the user's own data, but for "consolidate into a higher plan" and "replace with a cheaper alternative" the product has no plan prices or alternatives (FR-009 is parked). — Owner: user. Block: yes.
- **Risk:** This is the only thing that sets the product apart from a spreadsheet, and the savings rule is unresolved — better to block the slice on one decision than to plan a recommendation that promises amounts it cannot compute.
- **Status:** blocked

### S-06: User dismisses a recommendation

- **Outcome:** user can dismiss a recommendation, and a dismissed recommendation does not reappear on later visits to the summary screen.
- **Change ID:** dismiss-recommendation
- **PRD refs:** US-02, FR-007
- **Prerequisites:** S-05
- **Parallel with:** S-02, S-03, F-01
- **Blockers:** —
- **Unknowns:**
  - Does a dismissed recommendation come back when the group changes (e.g. a third subscription is added to that category)? — Owner: user. Block: no.
- **Risk:** It requires remembering the user's decision, i.e. new persisted data — split from S-05 so that showing recommendations does not wait on dismissal persistence.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                         | Suggested issue title                                            | Ready for `/10x-plan` | Notes |
| ---------- | --------------------------------- | ---------------------------------------------------------------- | --------------------- | ----- |
| F-01       | safe-release-verification         | Safe release verification: protected previews + full smoke test  | yes                   | #1 — Run `/10x-plan safe-release-verification`; must close before S-01 is promoted |
| S-01       | first-subscription-on-list        | Add the first subscription and show the subscription list        | yes                   | #2 — Run `/10x-plan first-subscription-on-list` |
| S-02       | edit-subscription                 | Edit a subscription                                              | no                    | #3 — Waits on S-01 |
| S-03       | delete-subscription               | Delete a subscription                                            | no                    | #4 — Waits on S-01 |
| S-04       | spending-summary                  | Spending summary (monthly and yearly total)                      | no                    | #5 — Waits on S-01 |
| S-05       | duplicate-category-recommendation | Savings recommendation for a duplicated category                 | no                    | #6 — Blocked: rule for naming the subscription and computing savings |
| S-06       | dismiss-recommendation            | Dismiss a recommendation                                         | no                    | #7 — Waits on S-05 |

## Open Roadmap Questions

The PRD has no open questions (all three were resolved on 2026-09-19). The questions below surfaced while decomposing the work:

1. **Recommendation rule: which subscription should be named, and how are savings computed for the "consolidate" and "replace" options without plan-price or alternative data?** — Owner: user. Block: S-05, S-06.
2. **Currency: one per account, or one per subscription?** — Owner: user. Block: roadmap-wide (low — default is a single currency; changing it later means migrating S-01 data and reworking S-04 totals).
3. **Is the `admin` role needed in this milestone at all, given that its only permission (FR-005) is parked?** — Owner: user. Block: roadmap-wide (low — default is the `user` role only).

## Parked

- **Bank integration / automatic transaction import** — Why parked: PRD §Non-Goals; all subscriptions are entered manually.
- **Account sharing between friends** — Why parked: PRD §Non-Goals; every user sees only their own data.
- **Offline availability** — Why parked: PRD §Non-Goals.
- **FR-005: admin-curated shared subscription catalog** — Why parked: nice-to-have; the "speed to launch" goal pushes everything beyond must-haves to a later milestone.
- **FR-008: automatic category assignment** — Why parked: nice-to-have, deliberately scoped out of the MVP in PRD §Business Logic.
- **FR-009: automatic fetching of plan details from the provider's website** — Why parked: nice-to-have, deliberately scoped out of the MVP in PRD §Business Logic.

## Milestone History

## Done
