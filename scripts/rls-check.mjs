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

const password = "Rls-Check-Passw0rd!";
const runId = Date.now();
let failures = 0;

function newClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

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
const starterId = bCats.data?.[0]?.id;

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
check("B cannot insert a subscription with user_id = A", Boolean(bAsA.error), describe(bAsA));

const bInACategory = await b.client
  .from("subscriptions")
  .insert({ name: "RLS B in A category", amount: 1, currency: "PLN", cycle: "monthly", category_id: aCategoryId })
  .select();
check("B cannot insert a subscription with A's category_id", Boolean(bInACategory.error), describe(bInACategory));

const bStarter = await b.client
  .from("categories")
  .insert({ name: `RLS starter ${runId}`, user_id: null })
  .select();
check("B cannot insert a category with user_id null", Boolean(bStarter.error), describe(bStarter));

// B cannot modify A's subscription: no grant/policy yet, so either a permission error or 0 affected rows.
const bUpdate = await b.client.from("subscriptions").update({ name: "hijacked" }).eq("id", aSubscriptionId).select();
check(
  "B updating A's subscription affects 0 rows",
  Boolean(bUpdate.error) || bUpdate.data.length === 0,
  describe(bUpdate),
);

const bDelete = await b.client.from("subscriptions").delete().eq("id", aSubscriptionId).select();
check(
  "B deleting A's subscription affects 0 rows",
  Boolean(bDelete.error) || bDelete.data.length === 0,
  describe(bDelete),
);

const aSubs = await a.client.from("subscriptions").select("id, name");
check(
  "A still sees exactly its one subscription, unchanged",
  !aSubs.error && aSubs.data.length === 1 && aSubs.data[0].id === aSubscriptionId && aSubs.data[0].name === "RLS A sub",
  describe(aSubs),
);

// An unauthenticated client sees nothing (no grant to anon: a permission error also counts as nothing).
const anonSubs = await anon.from("subscriptions").select("id");
check("anon sees 0 subscriptions", Boolean(anonSubs.error) || anonSubs.data.length === 0, describe(anonSubs));

const anonCats = await anon.from("categories").select("id");
check("anon sees 0 categories", Boolean(anonCats.error) || anonCats.data.length === 0, describe(anonCats));

if (failures > 0) {
  console.error(`rls-check: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("rls-check: all checks passed.");
