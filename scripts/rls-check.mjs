// RLS check: proves through the Supabase REST API (public anon key, like any attacker) that one account
// cannot read or write another account's subscriptions and categories, and that anon sees nothing.
// Local Supabase only: it signs up throwaway users. Never run it against hosted Supabase.
// Usage: SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_KEY=<anon key> npm run test:rls

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("rls-check: SUPABASE_URL and SUPABASE_KEY must be set (local Supabase API URL and anon key).");
  process.exit(1);
}

// Enforce "local only": against hosted Supabase each run would leave two users in the shared database.
const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];
let host = "";
try {
  host = new URL(SUPABASE_URL).hostname;
} catch {
  // Fall through: an unparseable URL is not a local one.
}
if (!LOCAL_HOSTS.includes(host)) {
  console.error(`rls-check: refusing to run against "${host || SUPABASE_URL}" — local Supabase only.`);
  process.exit(1);
}

const password = "Rls-Check-Passw0rd!";
const runId = Date.now();
let failures = 0;

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Postgres insufficient_privilege: what PostgREST returns when an RLS policy rejects a write.
const RLS_DENIED = "42501";
// Postgres check_violation: what a CHECK constraint (e.g. amount > 0) raises inside a write.
const CHECK_VIOLATION = "23514";

function check(name, ok, detail) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (${detail})`);
}

function describe({ data, error }) {
  if (error) return `error ${error.code ?? "?"}: ${error.message}`;
  if (Array.isArray(data)) return `${data.length} row(s)`;
  return data ? "1 row" : "0 rows";
}

async function signUp(label) {
  const client = newClient();
  const email = `rls-${label}-${runId}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.session || !data.user) {
    const reason = error ? error.message : "no session returned (are email confirmations enabled?)";
    console.error(`rls-check: sign-up of user ${label} failed: ${reason}`);
    process.exit(1);
  }
  return { client, userId: data.user.id };
}

const a = await signUp("a");
const b = await signUp("b");
const anon = newClient();

// A creates its own category and a subscription in it.
const aCategory = await a.client
  .from("categories")
  .insert({ name: `RLS A ${runId}`, user_id: a.userId })
  .select()
  .single();
check("A creates a category", !aCategory.error && aCategory.data.user_id === a.userId, describe(aCategory));

const aSubscription = aCategory.error
  ? aCategory
  : await a.client
      .from("subscriptions")
      .insert({ name: "RLS A sub", amount: 9.99, currency: "PLN", cycle: "monthly", category_id: aCategory.data.id })
      .select()
      .single();
check(
  "A creates a subscription in its category",
  !aSubscription.error && aSubscription.data.user_id === a.userId,
  describe(aSubscription),
);

if (aCategory.error || aSubscription.error) {
  console.error("rls-check: setup failed, cannot continue.");
  process.exit(1);
}
const aCategoryId = aCategory.data.id;
const aSubscriptionId = aSubscription.data.id;

// B reads nothing of A's.
const bSubs = await b.client.from("subscriptions").select("id");
check("B sees 0 subscriptions", !bSubs.error && bSubs.data.length === 0, describe(bSubs));

const bCats = await b.client.from("categories").select("id, user_id");
check(
  "B sees only starter categories (not A's)",
  !bCats.error && bCats.data.length > 0 && bCats.data.every((c) => c.user_id === null && c.id !== aCategoryId),
  describe(bCats),
);

// B cannot write rows owned by A, attach to A's category, or create a starter category.
// Each must be refused by RLS itself (42501), not by some unrelated constraint.
const starterId = bCats.data?.[0]?.id;
if (!starterId) {
  console.error("rls-check: no starter category visible to B, cannot continue.");
  process.exit(1);
}

const bAsA = await b.client
  .from("subscriptions")
  .insert({
    name: "RLS B as A",
    amount: 1,
    currency: "PLN",
    cycle: "monthly",
    category_id: starterId,
    user_id: a.userId,
  })
  .select();
check("B cannot insert a subscription with user_id = A", bAsA.error?.code === RLS_DENIED, describe(bAsA));

const bInACategory = await b.client
  .from("subscriptions")
  .insert({ name: "RLS B in A category", amount: 1, currency: "PLN", cycle: "monthly", category_id: aCategoryId })
  .select();
check(
  "B cannot insert a subscription with A's category_id",
  bInACategory.error?.code === RLS_DENIED,
  describe(bInACategory),
);

const bStarter = await b.client
  .from("categories")
  .insert({ name: `RLS starter ${runId}`, user_id: null })
  .select();
check("B cannot insert a category with user_id null", bStarter.error?.code === RLS_DENIED, describe(bStarter));

// B cannot delete A's subscription: there is no delete grant yet, so the request is refused outright (42501).
// When a delete feature adds the grant, this check must become "0 rows and A unchanged".
// (B's update of A's row is covered by the direct-PATCH check further down.)
const bDelete = await b.client.from("subscriptions").delete().eq("id", aSubscriptionId).select();
check("B cannot delete A's subscription (no delete grant)", bDelete.error?.code === RLS_DENIED, describe(bDelete));

const aSubs = await a.client.from("subscriptions").select("id, name");
check(
  "A still sees exactly its one subscription, unchanged",
  !aSubs.error && aSubs.data.length === 1 && aSubs.data[0].id === aSubscriptionId && aSubs.data[0].name === "RLS A sub",
  describe(aSubs),
);

// An unauthenticated client sees nothing: anon has no grant, so every read is refused (42501).
const anonSubs = await anon.from("subscriptions").select("id");
check("anon cannot read subscriptions", anonSubs.error?.code === RLS_DENIED, describe(anonSubs));

const anonCats = await anon.from("categories").select("id");
check("anon cannot read categories", anonCats.error?.code === RLS_DENIED, describe(anonCats));

// create_subscription RPC: one call is one transaction, and it runs with the caller's RLS.
const rpcArgs = { p_name: "RLS rpc sub", p_currency: "PLN", p_cycle: "monthly" };

const orphanName = `RLS orphan ${runId}`;
const aFailedSave = await a.client.rpc("create_subscription", { ...rpcArgs, p_amount: 0, p_new_category: orphanName });
// Expect the amount check itself, so the orphan check below always follows a function that actually ran.
check(
  "A's failed save (amount 0) is rejected by the amount check",
  aFailedSave.error?.code === CHECK_VIOLATION,
  describe(aFailedSave),
);
const orphan = await a.client.from("categories").select("id").eq("name", orphanName);
check(
  "A's failed save leaves no orphan category (whole call rolled back)",
  !orphan.error && orphan.data.length === 0,
  describe(orphan),
);

const bRpcInACategory = await b.client.rpc("create_subscription", {
  ...rpcArgs,
  p_amount: 1,
  p_category_id: aCategoryId,
});
check("B cannot save via RPC into A's category", bRpcInACategory.error?.code === RLS_DENIED, describe(bRpcInACategory));

const anonRpc = await anon.rpc("create_subscription", { ...rpcArgs, p_amount: 1, p_new_category: "RLS anon" });
check("anon cannot call create_subscription", anonRpc.error?.code === RLS_DENIED, describe(anonRpc));

// update_subscription RPC and the update policy: only the owner can change a row, the owner itself is
// immutable, the category must be visible to the owner, and a failed call changes nothing.
const NOT_FOUND = "P0002";
const aRow = () =>
  a.client
    .from("subscriptions")
    .select("name, amount, currency, cycle, category_id, user_id")
    .eq("id", aSubscriptionId);
const sameRow = (res, expected) =>
  !res.error && res.data.length === 1 && Object.entries(expected).every(([key, value]) => res.data[0][key] === value);

const edited = { name: "RLS A edited", amount: 19.5, currency: "EUR", cycle: "yearly", category_id: starterId };
const aOwnUpdate = await a.client.rpc("update_subscription", {
  p_id: aSubscriptionId,
  p_name: ` ${edited.name} `,
  p_amount: edited.amount,
  p_currency: edited.currency,
  p_cycle: edited.cycle,
  p_category_id: starterId,
});
check(
  "A updates its own subscription via RPC",
  !aOwnUpdate.error && aOwnUpdate.data === aSubscriptionId,
  describe(aOwnUpdate),
);
const aAfterOwn = await aRow();
check("A reads back the new values", sameRow(aAfterOwn, { ...edited, user_id: a.userId }), describe(aAfterOwn));

const updateArgs = { p_id: aSubscriptionId, p_name: "hijacked", p_amount: 1, p_currency: "PLN", p_cycle: "monthly" };

const bRpcUpdate = await b.client.rpc("update_subscription", { ...updateArgs, p_category_id: starterId });
check(
  "B's RPC update of A's subscription fails as not found",
  bRpcUpdate.error?.code === NOT_FOUND,
  describe(bRpcUpdate),
);

const bPatch = await b.client.from("subscriptions").update({ name: "hijacked" }).eq("id", aSubscriptionId).select();
check(
  "B's direct PATCH of A's subscription affects 0 rows",
  !bPatch.error && bPatch.data.length === 0,
  describe(bPatch),
);

const aAfterB = await aRow();
check("A's subscription is unchanged after B's attempts", sameRow(aAfterB, edited), describe(aAfterB));

const aOwner = await a.client.from("subscriptions").update({ user_id: b.userId }).eq("id", aSubscriptionId).select();
check("A cannot change user_id of its subscription", aOwner.error?.code === RLS_DENIED, describe(aOwner));

const bCategory = await b.client
  .from("categories")
  .insert({ name: `RLS B ${runId}`, user_id: b.userId })
  .select()
  .single();
check("B creates a private category", !bCategory.error, describe(bCategory));
if (bCategory.error) {
  console.error("rls-check: setup of B's category failed, cannot continue.");
  process.exit(1);
}
const bCategoryId = bCategory.data.id;

const aRpcIntoB = await a.client.rpc("update_subscription", { ...updateArgs, p_category_id: bCategoryId });
check(
  "A cannot move its subscription into B's category via RPC",
  aRpcIntoB.error?.code === RLS_DENIED,
  describe(aRpcIntoB),
);

const aPatchIntoB = await a.client
  .from("subscriptions")
  .update({ category_id: bCategoryId })
  .eq("id", aSubscriptionId)
  .select();
check(
  "A cannot move its subscription into B's category via PATCH",
  aPatchIntoB.error?.code === RLS_DENIED,
  describe(aPatchIntoB),
);

const editOrphanName = `RLS edit orphan ${runId}`;
const aFailedUpdate = await a.client.rpc("update_subscription", {
  ...updateArgs,
  p_amount: 0,
  p_new_category: editOrphanName,
});
// Expect the amount check itself, so the checks below always follow a function that actually ran.
check(
  "A's failed update (amount 0) is rejected by the amount check",
  aFailedUpdate.error?.code === CHECK_VIOLATION,
  describe(aFailedUpdate),
);
const editOrphan = await a.client.from("categories").select("id").eq("name", editOrphanName);
check(
  "A's failed update creates no category (whole call rolled back)",
  !editOrphan.error && editOrphan.data.length === 0,
  describe(editOrphan),
);
const aAfterFailed = await aRow();
check("A's subscription is unchanged after the failed update", sameRow(aAfterFailed, edited), describe(aAfterFailed));

// B saves with a new category named like A's private one: the function must create B's own category,
// never reuse A's, which B cannot see. A failed call fails every check here (no vacuous pass).
const bSameName = await b.client.rpc("create_subscription", {
  ...rpcArgs,
  p_amount: 1,
  p_new_category: `RLS A ${runId}`,
});
check(
  "B saves via RPC with a new category named like A's",
  !bSameName.error && typeof bSameName.data === "string",
  describe(bSameName),
);
const bSameNameSub = bSameName.error
  ? bSameName
  : await b.client.from("subscriptions").select("category_id").eq("id", bSameName.data);
const bSameNameCategoryId = bSameNameSub.error ? undefined : bSameNameSub.data[0]?.category_id;
const bSameNameCategory = bSameNameCategoryId
  ? await b.client.from("categories").select("id, user_id").eq("id", bSameNameCategoryId)
  : bSameNameSub;
check(
  "B's same-name save lands in B's own category, not A's",
  !bSameNameCategory.error &&
    bSameNameCategory.data.length === 1 &&
    bSameNameCategory.data[0].id !== aCategoryId &&
    bSameNameCategory.data[0].user_id === b.userId,
  describe(bSameNameCategory),
);

const anonUpdate = await anon.rpc("update_subscription", { ...updateArgs, p_category_id: starterId });
check("anon cannot call update_subscription", anonUpdate.error?.code === RLS_DENIED, describe(anonUpdate));

if (failures > 0) {
  console.error(`rls-check: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("rls-check: all checks passed.");
