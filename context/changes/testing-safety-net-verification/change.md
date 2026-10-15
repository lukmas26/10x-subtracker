---
change_id: testing-safety-net-verification
title: Verify smoke and RLS checks catch leaks and unauthenticated access
status: implementing
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Safety-net verification".
Risks covered: #3 (safety net reports PASS while protected behaviour is broken), #1 (signed-in user reads/edits/saves another account's subscription or private category), #5 (anonymous visitor reaches a protected page or API route). Test types planned: deliberate-break runs, integration (REST), smoke.
Risk response intent:

- #3: every smoke step and RLS check must fail when its protected behaviour is deliberately broken; no check that cannot fail, no expected values lifted from the implementation.
- #1: account B is denied on every path (list, edit page, save, RPC, direct REST write) and A's data is unchanged afterwards; not only the list view.
- #5: every protected page and endpoint rejects anonymous requests; a new route cannot skip protection without a red test; not just one example route.
  After creating the folder, follow the downstream continuation rule.
