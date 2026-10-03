---
change_id: first-subscription-on-list
title: Add the first subscription and show the subscription list
status: archived
created: 2026-10-02
updated: 2026-10-03
archived_at: 2026-10-03T05:52:20Z
---

## Notes

Roadmap S-01 (north star), from `context/foundation/roadmap.md`, backlog issue #2.

Outcome: once signed in, a user can add a subscription (name, amount, monthly/yearly cycle, and a category picked from a list or created on the spot) and see it right away on their own subscription list. Only they can see it.

PRD refs: US-01, FR-001, FR-002, NFR (financial data privacy, fast action confirmation, desktop and mobile browsers).

Open unknowns (non-blocking, roadmap defaults):
- Currency: a single currency for all amounts (e.g. PLN) unless decided otherwise.
- Initial categories: a short starter list plus the user's own categories (FR-005 shared catalog is parked).

Risk: this is the first table that holds financial data and the first RLS policies. The plan must explicitly check that a second account cannot see another account's subscriptions.

Promotion gate: F-01 (safe-release-verification) is done, so use its protected preview and remote smoke path to verify before promotion.
