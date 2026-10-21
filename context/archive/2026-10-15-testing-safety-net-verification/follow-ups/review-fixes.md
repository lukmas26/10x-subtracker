# Review follow-ups — testing-safety-net-verification

From `reviews/impl-review.md` (2026-10-19).

- **F2 → `/10x-test-plan` backport.** Raise as negative space for risk #5: the route inventory proves completeness, not classification. A page that should be protected but is listed as `public` and missing from `PROTECTED_ROUTES` passes every check, and only review catches it. Consider testing the middleware directly once test-plan Phase 2 picks a runner for `src/`.
