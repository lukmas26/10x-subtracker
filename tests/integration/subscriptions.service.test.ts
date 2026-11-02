// Risks #2 and #4 at the service layer: createSubscription/updateSubscription return honest Result values,
// and a failed call (including one that fails after creating a category in the same RPC) changes nothing.
// Every assertion re-reads persisted state with a healthy signed-in client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/database.types";
import {
  SUBSCRIPTION_ERRORS,
  createSubscription,
  getSubscription,
  listSubscriptions,
  updateSubscription,
  type NewSubscriptionInput,
} from "@/lib/services/subscriptions";

import { newClient, runId, signUpUser } from "../helpers/supabase";

type Client = SupabaseClient<Database>;

// Two throwaway users for the whole file (local sign-ups are rate limited): `client` is the user under test,
// `other` owns the private category and subscription that `client` must not be able to use.
let client: Client;
let userId: string;
let other: Client;
let otherCategoryId: string;
let otherSubscriptionId: string;
let streamingId: string;
let musicId: string;

/** A client signed in as `client`'s user whose data API requests fail at the network level. */
let offline: Client;

let seq = 0;
/** A name unique to this run and call, so tests never see each other's rows. */
function unique(label: string): string {
  seq += 1;
  return `svc ${label} ${runId} ${String(seq)}`;
}

function input(overrides: Partial<NewSubscriptionInput> = {}): NewSubscriptionInput {
  return {
    name: unique("sub"),
    amount: "49.99",
    currency: "PLN",
    cycle: "monthly",
    categoryId: streamingId,
    newCategory: null,
    ...overrides,
  };
}

async function starterId(name: string): Promise<string> {
  const { data, error } = await client.from("categories").select("id").is("user_id", null).eq("name", name).single();
  if (error) throw new Error(`could not load the starter category ${name}: ${error.message}`);
  return data.id;
}

/** The ids of the user's own categories and subscriptions. */
async function ownRows(): Promise<{ subscriptions: string[]; categories: string[] }> {
  const [subscriptions, categories] = await Promise.all([
    client.from("subscriptions").select("id").order("id"),
    client.from("categories").select("id").eq("user_id", userId).order("id"),
  ]);
  if (subscriptions.error) throw new Error(subscriptions.error.message);
  if (categories.error) throw new Error(categories.error.message);
  return {
    subscriptions: subscriptions.data.map((row) => row.id),
    categories: categories.data.map((row) => row.id),
  };
}

/** Whether a category with exactly this name is visible to the user (starter or own). */
async function categoryExists(name: string): Promise<boolean> {
  const { data, error } = await client.from("categories").select("id").eq("name", name);
  if (error) throw new Error(error.message);
  return data.length > 0;
}

/** The other user's subscription as that user sees it. */
async function otherRow(): Promise<unknown> {
  const { data, error } = await other.from("subscriptions").select("*").eq("id", otherSubscriptionId).single();
  if (error) throw new Error(error.message);
  return data;
}

/** Creates a subscription through the service and returns its id. */
async function seed(): Promise<string> {
  const values = input();
  const result = await createSubscription(client, values);
  if (!result.ok) throw new Error(`seeding failed: ${result.error}`);
  const rows = (await listSubscriptions(client)).filter((row) => row.name === values.name);
  if (rows.length !== 1) throw new Error(`seeding: expected one row named ${values.name}`);
  return rows[0].id;
}

beforeAll(async () => {
  ({ client, userId } = await signUpUser("service"));
  const otherUser = await signUpUser("service-other");
  other = otherUser.client;
  streamingId = await starterId("Streaming");
  musicId = await starterId("Music");

  const category = await other
    .from("categories")
    .insert({ user_id: otherUser.userId, name: `svc private ${runId}` })
    .select("id")
    .single();
  if (category.error) throw new Error(`could not create the other user's category: ${category.error.message}`);
  otherCategoryId = category.data.id;

  const subscription = await other.rpc("create_subscription", {
    p_name: `svc other ${runId}`,
    p_amount: 10,
    p_currency: "EUR",
    p_cycle: "yearly",
    p_category_id: otherCategoryId,
  });
  if (subscription.error) {
    throw new Error(`could not create the other user's subscription: ${subscription.error.message}`);
  }
  otherSubscriptionId = subscription.data;

  // Auth requests go through, so the client holds the user's real session; data API requests reject
  // the way fetch does when the network is down.
  offline = newClient({
    fetch: (resource, init) => {
      const url = resource instanceof Request ? resource.url : String(resource);
      return url.includes("/rest/v1/") ? Promise.reject(new TypeError("fetch failed")) : fetch(resource, init);
    },
  });
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) throw new Error("the signed-in client has no session");
  const { error: sessionError } = await offline.auth.setSession(sessionData.session);
  if (sessionError) throw new Error(`could not copy the session: ${sessionError.message}`);
});

describe("createSubscription", () => {
  it("saves the row with the sent values and reports ok", async () => {
    const values = input({ amount: "1234.50", currency: "USD", cycle: "yearly" });

    expect(await createSubscription(client, values)).toEqual({ ok: true });

    const rows = (await listSubscriptions(client)).filter((row) => row.name === values.name);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: values.name,
      amount: "1234.50",
      currency: "USD",
      cycle: "yearly",
      categoryName: "Streaming",
    });
  });

  it("reports save and adds nothing for another user's private category", async () => {
    const before = await ownRows();

    expect(await createSubscription(client, input({ categoryId: otherCategoryId }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.save,
    });
    expect(await ownRows()).toEqual(before);
  });

  it("reports save and adds nothing for an unknown category id", async () => {
    const before = await ownRows();

    expect(await createSubscription(client, input({ categoryId: crypto.randomUUID() }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.save,
    });
    expect(await ownRows()).toEqual(before);
  });

  it("reports save on a network failure and changes nothing", async () => {
    const before = await ownRows();
    const newCategory = unique("cat");

    expect(await createSubscription(offline, input({ categoryId: null, newCategory }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.save,
    });
    expect(await ownRows()).toEqual(before);
    expect(await categoryExists(newCategory)).toBe(false);
  });
});

describe("updateSubscription", () => {
  it("saves the new values and reports ok", async () => {
    const id = await seed();
    const values = input({ amount: "0.50", currency: "EUR", cycle: "yearly", categoryId: musicId });

    expect(await updateSubscription(client, id, values)).toEqual({ ok: true });
    expect(await getSubscription(client, id)).toEqual({
      id,
      name: values.name,
      amount: "0.50",
      currency: "EUR",
      cycle: "yearly",
      categoryId: musicId,
    });
  });

  it("rolls back the new category when the amount fails after it was created (save)", async () => {
    const id = await seed();
    const before = await getSubscription(client, id);
    expect(before).not.toBeNull();
    const newCategory = unique("cat");

    // amount "0" bypasses the parser on purpose: the database rejects it after inserting the category.
    expect(await updateSubscription(client, id, input({ amount: "0", categoryId: null, newCategory }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.save,
    });
    expect(await getSubscription(client, id)).toEqual(before);
    expect(await categoryExists(newCategory)).toBe(false);
  });

  it.each([
    { label: "an unknown id", id: () => crypto.randomUUID() },
    { label: "another user's id", id: () => otherSubscriptionId },
  ])("rolls back the new category for $label (notFound)", async ({ id }) => {
    const ownId = await seed();
    const before = await getSubscription(client, ownId);
    expect(before).not.toBeNull();
    const rowsBefore = await ownRows();
    const otherBefore = await otherRow();
    const newCategory = unique("cat");

    expect(await updateSubscription(client, id(), input({ categoryId: null, newCategory }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.notFound,
    });
    expect(await getSubscription(client, ownId)).toEqual(before);
    expect(await ownRows()).toEqual(rowsBefore);
    expect(await categoryExists(newCategory)).toBe(false);
    expect(await otherRow()).toEqual(otherBefore);
  });

  it("reports save on a network failure and changes nothing", async () => {
    const id = await seed();
    const before = await getSubscription(client, id);
    expect(before).not.toBeNull();
    const rowsBefore = await ownRows();
    const newCategory = unique("cat");

    expect(await updateSubscription(offline, id, input({ categoryId: null, newCategory }))).toEqual({
      ok: false,
      error: SUBSCRIPTION_ERRORS.save,
    });
    expect(await getSubscription(client, id)).toEqual(before);
    expect(await ownRows()).toEqual(rowsBefore);
    expect(await categoryExists(newCategory)).toBe(false);
  });
});
