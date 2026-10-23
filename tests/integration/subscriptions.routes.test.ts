// Risk #4 at the route layer: the add and edit POST handlers map the service result to the redirect that
// decides whether the success banner appears. Each case asserts the exact Location path and query, then
// re-reads persisted state with a healthy signed-in client.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/database.types";
import { SUBSCRIPTION_ERRORS, getSubscription, listSubscriptions } from "@/lib/services/subscriptions";
import { POST as addSubscription } from "@/pages/api/subscriptions";
import { POST as editSubscription } from "@/pages/api/subscriptions/[id]";

import { makeContext, redirectTarget } from "../helpers/api-context";
import { newClient, runId, signUpUser } from "../helpers/supabase";

type Client = SupabaseClient<Database>;

// Two throwaway users for the whole file (local sign-ups are rate limited): `client`/`user` is the user under
// test, `other` owns the private category and subscription that `client` must not be able to use.
let client: Client;
let user: User;
let userId: string;
let other: Client;
let otherCategoryId: string;
let otherSubscriptionId: string;
let streamingId: string;
let musicId: string;

/** A client signed in as `user` whose data API requests fail at the network level. */
let offline: Client;

let seq = 0;
function unique(label: string): string {
  seq += 1;
  return `route ${label} ${runId} ${String(seq)}`;
}

function form(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: unique("sub"),
    amount: "49.99",
    currency: "PLN",
    cycle: "monthly",
    category_id: streamingId,
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

/** The user's subscriptions with this exact name. */
async function rowsNamed(name: string) {
  return (await listSubscriptions(client)).filter((row) => row.name === name);
}

/** The other user's subscription as that user sees it. */
async function otherRow(): Promise<unknown> {
  const { data, error } = await other.from("subscriptions").select("*").eq("id", otherSubscriptionId).single();
  if (error) throw new Error(error.message);
  return data;
}

/** Adds a subscription through the add route and returns its id. */
async function seed(): Promise<string> {
  const values = form();
  const response = await addSubscription(makeContext({ supabase: client, user, form: values }));
  expect(redirectTarget(response).path).toBe("/subscriptions");
  const rows = await rowsNamed(values.name);
  if (rows.length !== 1) throw new Error(`seeding: expected one row named ${values.name}`);
  return rows[0].id;
}

/** Asserts a redirect to exactly `path` with exactly the query `params`. */
function expectRedirect(response: Response, path: string, params: Record<string, string>): void {
  const target = redirectTarget(response);
  expect(target.path).toBe(path);
  expect(Object.fromEntries(target.params)).toEqual(params);
}

beforeAll(async () => {
  ({ client, userId } = await signUpUser("routes"));
  const otherUser = await signUpUser("routes-other");
  other = otherUser.client;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw new Error(`could not load the signed-in user: ${userError.message}`);
  user = userData.user;
  streamingId = await starterId("Streaming");
  musicId = await starterId("Music");

  const category = await other
    .from("categories")
    .insert({ user_id: otherUser.userId, name: `route private ${runId}` })
    .select("id")
    .single();
  if (category.error) throw new Error(`could not create the other user's category: ${category.error.message}`);
  otherCategoryId = category.data.id;

  const subscription = await other.rpc("create_subscription", {
    p_name: `route other ${runId}`,
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

describe("POST /api/subscriptions (add)", () => {
  it("valid: redirects with saved=1 and the row exists", async () => {
    const values = form({ amount: "12,30" });

    const response = await addSubscription(makeContext({ supabase: client, user, form: values }));

    expectRedirect(response, "/subscriptions", { saved: "1" });
    const rows = await rowsNamed(values.name);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: "12.30", currency: "PLN", cycle: "monthly", categoryName: "Streaming" });
  });

  it("invalid amount: redirects with the amount error, no saved, and adds no row", async () => {
    const before = await ownRows();
    const values = form({ amount: "12.345" });

    const response = await addSubscription(makeContext({ supabase: client, user, form: values }));

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.amountFormat });
    expect(await ownRows()).toEqual(before);
  });

  it("database failure: redirects with the save error, no saved, and adds no row or category", async () => {
    const before = await ownRows();
    // Valid for the parser; the insert policy rejects another user's private category.
    const values = form({ category_id: otherCategoryId });

    const response = await addSubscription(makeContext({ supabase: client, user, form: values }));

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.save });
    expect(await ownRows()).toEqual(before);
  });

  it("no user: redirects to sign-in and adds no row", async () => {
    const before = await ownRows();

    const response = await addSubscription(makeContext({ supabase: client, user: null, form: form() }));

    expectRedirect(response, "/auth/signin", {});
    expect(await ownRows()).toEqual(before);
  });

  it("null client: redirects with the not-configured error", async () => {
    const response = await addSubscription(makeContext({ supabase: null, user, form: form() }));

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.notConfigured });
  });
});

describe("POST /api/subscriptions/[id] (edit)", () => {
  it("valid: redirects with updated=1 and the row has the new values", async () => {
    const id = await seed();
    const values = form({ amount: "7.05", currency: "USD", cycle: "yearly", category_id: musicId });

    const response = await editSubscription(makeContext({ supabase: client, user, form: values, params: { id } }));

    expectRedirect(response, "/subscriptions", { updated: "1" });
    expect(await getSubscription(client, id)).toEqual({
      id,
      name: values.name,
      amount: "7.05",
      currency: "USD",
      cycle: "yearly",
      categoryId: musicId,
    });
  });

  it("invalid amount: redirects to the edit page with the amount error and the row is unchanged", async () => {
    const id = await seed();
    const before = await getSubscription(client, id);

    const response = await editSubscription(
      makeContext({ supabase: client, user, form: form({ amount: "abc" }), params: { id } }),
    );

    expectRedirect(response, `/subscriptions/${id}/edit`, { error: SUBSCRIPTION_ERRORS.amountFormat });
    expect(await getSubscription(client, id)).toEqual(before);
  });

  it("another user's id: redirects with notFound and both rows are unchanged", async () => {
    const ownId = await seed();
    const ownBefore = await getSubscription(client, ownId);
    const rowsBefore = await ownRows();
    const otherBefore = await otherRow();

    const response = await editSubscription(
      makeContext({
        supabase: client,
        user,
        form: form({ category_id: "", new_category: unique("cat") }),
        params: { id: otherSubscriptionId },
      }),
    );

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.notFound });
    expect(await getSubscription(client, ownId)).toEqual(ownBefore);
    expect(await ownRows()).toEqual(rowsBefore);
    expect(await otherRow()).toEqual(otherBefore);
  });

  it("malformed id: redirects with notFound", async () => {
    const response = await editSubscription(
      makeContext({ supabase: client, user, form: form(), params: { id: "not-a-uuid" } }),
    );

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.notFound });
  });

  it("network failure: redirects to the edit page with the save error and the row is unchanged", async () => {
    const id = await seed();
    const before = await getSubscription(client, id);
    const rowsBefore = await ownRows();

    const response = await editSubscription(
      makeContext({ supabase: offline, user, form: form({ category_id: musicId }), params: { id } }),
    );

    expectRedirect(response, `/subscriptions/${id}/edit`, { error: SUBSCRIPTION_ERRORS.save });
    expect(await getSubscription(client, id)).toEqual(before);
    expect(await ownRows()).toEqual(rowsBefore);
  });

  it("no user: redirects to sign-in and the row is unchanged", async () => {
    const id = await seed();
    const before = await getSubscription(client, id);

    const response = await editSubscription(
      makeContext({ supabase: client, user: null, form: form(), params: { id } }),
    );

    expectRedirect(response, "/auth/signin", {});
    expect(await getSubscription(client, id)).toEqual(before);
  });

  it("null client: redirects with the not-configured error", async () => {
    const response = await editSubscription(
      makeContext({ supabase: null, user, form: form(), params: { id: crypto.randomUUID() } }),
    );

    expectRedirect(response, "/subscriptions", { error: SUBSCRIPTION_ERRORS.notConfigured });
  });
});
