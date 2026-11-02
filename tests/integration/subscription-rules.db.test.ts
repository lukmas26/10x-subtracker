// Risk #6: the case table run against the database layer. Each dbApplicable row calls create_subscription
// directly as a signed-in user, bypassing the parser, and re-reads persisted state.
// Expected verdicts, codes and stored values come from tests/cases/subscription-cases.ts only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/database.types";
import { NEW_CATEGORY } from "@/lib/services/subscription-validation";
import { normaliseAmount } from "@/types";

import {
  STARTER_CATEGORY_ID,
  STARTER_CATEGORY_NAME,
  subscriptionCases,
  type FormInput,
} from "../cases/subscription-cases";
import { signUpUser } from "../helpers/supabase";

type Client = SupabaseClient<Database>;
type CreateArgs = Database["public"]["Functions"]["create_subscription"]["Args"];

// One throwaway user for the whole file: local sign-ups are rate limited (30 per 5 minutes per IP).
// Each test compares the user's rows before and after its own call, so tests never depend on order.
let client: Client;
let userId: string;
let starterCategoryId: string;

beforeAll(async () => {
  ({ client, userId } = await signUpUser("rules"));
  const { data, error } = await client
    .from("categories")
    .select("id")
    .is("user_id", null)
    .eq("name", STARTER_CATEGORY_NAME)
    .single();
  if (error) throw new Error(`could not load the starter category: ${error.message}`);
  starterCategoryId = data.id;
});

/** The raw form values as create_subscription arguments, without the parser's checks. */
function toArgs(input: FormInput): CreateArgs {
  const category =
    input.category_id === NEW_CATEGORY
      ? { p_new_category: input.new_category }
      : input.category_id === STARTER_CATEGORY_ID
        ? { p_category_id: starterCategoryId }
        : {};
  return {
    p_name: input.name,
    // The amount goes as the decimal text the app's normalisation yields (comma to dot), not as a JS number,
    // so non-numeric input and values beyond a double's precision reach Postgres as typed.
    p_amount: normaliseAmount(input.amount) as unknown as number,
    p_currency: input.currency,
    p_cycle: input.cycle,
    ...category,
  };
}

/** The user's own subscription and category ids, to prove a failed call changed nothing. */
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

const dbCases = subscriptionCases.filter((row) => row.dbApplicable);

describe("create_subscription (database layer)", () => {
  it.each(dbCases)("$id", async (row) => {
    const before = await ownRows();
    const { data, error } = await client.rpc("create_subscription", toArgs(row.input));
    const verdict = row.db?.verdict ?? row.verdict;

    if (verdict === "reject") {
      expect(data).toBeNull();
      // A reject row must name its code, or undefined === undefined would pass for any error.
      expect(row.db?.code).toBeDefined();
      expect(error?.code).toBe(row.db?.code);
      expect(await ownRows()).toEqual(before);
      return;
    }

    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    if (!row.stored) {
      throw new Error(`case ${row.id} is accepted but has no expected stored values`);
    }
    const stored = await client
      .from("subscriptions")
      .select("name, amount:amount::text, currency, cycle, category:categories(name, user_id)")
      .eq("id", data ?? "")
      .single();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual({
      name: row.stored.name,
      amount: row.stored.amount,
      currency: row.input.currency,
      cycle: row.input.cycle,
      category: row.stored.category
        ? { name: row.stored.category, user_id: userId }
        : { name: STARTER_CATEGORY_NAME, user_id: null },
    });
  });
});
