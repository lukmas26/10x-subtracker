---
change_id: edit-subscription
title: Edit a subscription
status: planned
created: 2026-10-10
updated: 2026-10-10
archived_at: null
---

## Notes

Roadmap S-02, from `context/foundation/roadmap.md`, backlog issue #3.

Outcome: a user can change the name, amount, cycle or category of an existing subscription and see a save confirmation; a failed save does not wipe the previous data.

PRD refs: FR-003, NFR (no data loss), NFR (fast action confirmation).

Risk: a partial write on a dropped connection — the save must be one atomic database call (`context/foundation/lessons.md`).
