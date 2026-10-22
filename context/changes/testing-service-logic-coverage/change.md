---
change_id: testing-service-logic-coverage
title: Test plan Phase 2 — service logic coverage (atomic writes, honest feedback, one rule set)
status: new
created: 2026-10-21
updated: 2026-10-21
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Service logic coverage".
Risks covered: #2 (a failed or interrupted edit save changes or wipes an existing subscription), #4 (user sees a "saved/updated" confirmation although nothing was persisted, or the subscription lands in a wrong or duplicated category), #6 (validation and permission rules drift between form, server, and database, or the server trusts what the client sent). Test types planned: unit + integration (local Supabase); bootstrap a test runner for service code.
Risk response intent:
- #2: after a forced failure (invalid amount, new category name, dropped connection) the stored row is identical and no category was created; re-read persisted state, never assert only the redirect.
- #4: success feedback appears only when the row really exists; an existing category typed with different case/whitespace is reused, not duplicated; do not mock the database client so every call succeeds.
- #6: one shared case table (valid and boundary inputs, sourced from the PRD) yields the same verdict in form, server, and database; do not re-implement the rule inside the test.
After creating the folder, follow the downstream continuation rule.
