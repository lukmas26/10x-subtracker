# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Multi-step writes across tables are not atomic

- **Context**: supabase/migrations/20261003140000_create_subscription_rpc.sql (fixed via a single-RPC transaction: the category and the subscription are now written inside one function; `update_subscription` follows the same pattern)
- **Problem**: Creating a category and inserting the subscription are separate PostgREST calls. If the second fails, the first stays committed (an orphan category). It is harmless here because the next attempt reuses it, but the pattern silently leaves partial writes.
- **Rule**: All database changes made within a single API call must be atomic — all or nothing.
- **Applies to**: Everything: whenever an API call performs several inserts/updates/deletes and any one of them returns an error, the whole call is rolled back.
