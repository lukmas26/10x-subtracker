// Risk #4: a category typed differently is reused, not duplicated. The matching rule lives in SQL only, so
// every case runs against create_subscription and update_subscription, called directly with the raw
// p_new_category, and once through createSubscription. The rule (research Decision 3): case-insensitive,
// outer whitespace trimmed, starters first, no wildcards; inner whitespace is not normalised.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/database.types";
import { createSubscription } from "@/lib/services/subscriptions";

import { runId, signUpUser } from "../helpers/supabase";

type Client = SupabaseClient<Database>;
type Rpc = "create_subscription" | "update_subscription";

/** Own categories every user starts with; none of these names matches a starter. */
const OWN = ["Video", "ŁÓDŹ", "Photo storage"] as const;
type OwnName = (typeof OWN)[number];

/** A signed-in throwaway user with its own categories already created. */
interface Fixture {
  client: Client;
  userId: string;
  streamingId: string;
  own: Record<OwnName, string>;
}

let seq = 0;
/** A subscription name unique to this run and call. */
function unique(label: string): string {
  seq += 1;
  return `reuse ${label} ${runId} ${String(seq)}`;
}

// One user per RPC plus one for the service path (local sign-ups are rate limited). A user's cases either
// reuse a category or create one whose name no other case of that user types, so they never depend on order.
async function setUp(label: string): Promise<Fixture> {
  const { client, userId } = await signUpUser(label);
  const starter = await client.from("categories").select("id").is("user_id", null).eq("name", "Streaming").single();
  if (starter.error) throw new Error(`could not load the starter category Streaming: ${starter.error.message}`);

  const inserted = await client
    .from("categories")
    .insert(OWN.map((name) => ({ user_id: userId, name })))
    .select("id, name");
  if (inserted.error) throw new Error(`could not create the own categories: ${inserted.error.message}`);
  const own = Object.fromEntries(inserted.data.map((row) => [row.name, row.id])) as Record<OwnName, string>;

  return { client, userId, streamingId: starter.data.id, own };
}

/** The ids of the user's own categories. */
async function ownCategories(fixture: Fixture): Promise<string[]> {
  const { data, error } = await fixture.client.from("categories").select("id").eq("user_id", fixture.userId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.id);
}

async function categoryOf(fixture: Fixture, subscriptionId: string): Promise<string> {
  const { data, error } = await fixture.client
    .from("subscriptions")
    .select("category_id")
    .eq("id", subscriptionId)
    .single();
  if (error) throw new Error(error.message);
  return data.category_id;
}

/** The own category with exactly this name, if the user has one. */
async function ownCategoryNamed(fixture: Fixture, name: string): Promise<string | undefined> {
  const { data, error } = await fixture.client
    .from("categories")
    .select("id")
    .eq("user_id", fixture.userId)
    .eq("name", name);
  if (error) throw new Error(error.message);
  return data[0]?.id;
}

const base = { p_amount: 9.99, p_currency: "PLN", p_cycle: "monthly" } as const;

/** Saves a subscription through `rpc` with the raw new-category text and returns the category it got. */
async function saveWith(fixture: Fixture, rpc: Rpc, newCategory: string): Promise<string> {
  let result;
  if (rpc === "create_subscription") {
    result = await fixture.client.rpc(rpc, { ...base, p_name: unique("sub"), p_new_category: newCategory });
  } else {
    const seeded = await fixture.client.rpc("create_subscription", {
      ...base,
      p_name: unique("seed"),
      p_category_id: fixture.streamingId,
    });
    if (seeded.error) throw new Error(`seeding failed: ${seeded.error.message}`);
    result = await fixture.client.rpc(rpc, {
      ...base,
      p_id: seeded.data,
      p_name: unique("sub"),
      p_new_category: newCategory,
    });
  }
  expect(result.error).toBeNull();
  if (result.data === null) throw new Error(`${rpc} returned no id`);
  return categoryOf(fixture, result.data);
}

describe.each<{ rpc: Rpc }>([{ rpc: "create_subscription" }, { rpc: "update_subscription" }])("$rpc", ({ rpc }) => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await setUp(rpc === "create_subscription" ? "reuse-create" : "reuse-update");
  });

  it.each(["  streaming ", "STREAMING"])("reuses the starter Streaming for %j", async (typed) => {
    const before = await ownCategories(fixture);

    expect(await saveWith(fixture, rpc, typed)).toBe(fixture.streamingId);
    expect((await ownCategories(fixture)).sort()).toEqual(before.sort());
  });

  it.each<{ typed: string; existing: OwnName }>([
    { typed: "VIDEO", existing: "Video" },
    { typed: " video ", existing: "Video" },
    { typed: "łódź", existing: "ŁÓDŹ" },
  ])("reuses the own $existing for $typed", async ({ typed, existing }) => {
    const before = await ownCategories(fixture);

    expect(await saveWith(fixture, rpc, typed)).toBe(fixture.own[existing]);
    expect((await ownCategories(fixture)).sort()).toEqual(before.sort());
  });

  it("creates a new category for inner double spaces (the pinned boundary)", async () => {
    const before = await ownCategories(fixture);

    const categoryId = await saveWith(fixture, rpc, "Photo  storage");

    expect(categoryId).not.toBe(fixture.own["Photo storage"]);
    expect(await ownCategoryNamed(fixture, "Photo  storage")).toBe(categoryId);
    expect(await ownCategories(fixture)).toHaveLength(before.length + 1);
  });

  it('creates "S%" as its own category, not a wildcard match for Streaming', async () => {
    const before = await ownCategories(fixture);

    const categoryId = await saveWith(fixture, rpc, "S%");

    expect(categoryId).not.toBe(fixture.streamingId);
    expect(await ownCategoryNamed(fixture, "S%")).toBe(categoryId);
    expect(await ownCategories(fixture)).toHaveLength(before.length + 1);
  });
});

describe("createSubscription (service path)", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await setUp("reuse-service");
  });

  it('reuses the own "Video" for "video"', async () => {
    const before = await ownCategories(fixture);
    const name = unique("svc");

    expect(
      await createSubscription(fixture.client, {
        name,
        amount: "9.99",
        currency: "PLN",
        cycle: "monthly",
        categoryId: null,
        newCategory: "video",
      }),
    ).toEqual({ ok: true });

    const { data, error } = await fixture.client.from("subscriptions").select("category_id").eq("name", name);
    expect(error).toBeNull();
    expect(data).toEqual([{ category_id: fixture.own.Video }]);
    expect((await ownCategories(fixture)).sort()).toEqual(before.sort());
  });
});
