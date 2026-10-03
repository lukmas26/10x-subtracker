# Review fixes — follow-ups

From `reviews/impl-review.md` triage (2026-10-03).

- [x] **Hosted rollout of the review fixes (F3, F2, F7, F8).** Done 2026-10-03 (Pass 5, version `3d3f296a`). The new migration
      `20261003140000_create_subscription_rpc.sql` must reach hosted Supabase **before** a version that
      calls `create_subscription` is uploaded. It is additive, so the live version `b00106c6` keeps
      working: human `npx supabase db push`, then the runbook (build → `versions upload` → preview
      `smoke:remote` 10/10 → approval → `versions deploy` → production 9/9), plus a runbook Pass entry.
- [ ] **Auth routes onto `locals.supabase` (F2).** `src/pages/api/auth/{signin,signup,signout}.ts`
      still build their own client with `createClient`. They were left out because the plan excluded
      auth-route changes; move them to `context.locals.supabase` in a later change so every route uses
      the one per-request client.
