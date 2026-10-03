import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import {
  AMOUNT_PATTERN,
  CATEGORY_NAME_MAX_LENGTH,
  CURRENCIES,
  CYCLES,
  SUBSCRIPTION_NAME_MAX_LENGTH,
  normaliseAmount,
  type CategoryDTO,
  type Currency,
  type Cycle,
  type SubscriptionListItemDTO,
} from "@/types";

type Client = SupabaseClient<Database>;

export interface NewSubscriptionInput {
  name: string;
  /** Canonical decimal string with a dot separator, e.g. "49.99". */
  amount: string;
  currency: Currency;
  cycle: Cycle;
  /** Set when the user picked an existing category. */
  categoryId: string | null;
  /** Set (trimmed, non-empty) when the user typed a new category; takes precedence over `categoryId`. */
  newCategory: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const SAVE_ERROR = "Could not save the subscription. Please try again.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

export function parseNewSubscription(form: FormData): Result<NewSubscriptionInput> {
  const name = field(form, "name").trim();
  if (name.length === 0) return { ok: false, error: "Name is required." };
  if (name.length > SUBSCRIPTION_NAME_MAX_LENGTH) {
    return { ok: false, error: `Name must be at most ${String(SUBSCRIPTION_NAME_MAX_LENGTH)} characters.` };
  }

  const rawAmount = field(form, "amount").trim();
  if (!AMOUNT_PATTERN.test(rawAmount)) {
    return { ok: false, error: "Amount must be a number with up to 2 decimal places, e.g. 49.99." };
  }
  const amount = normaliseAmount(rawAmount);
  if (!(Number(amount) > 0)) return { ok: false, error: "Amount must be greater than 0." };

  const currency = field(form, "currency");
  if (!isOneOf(CURRENCIES, currency)) {
    return { ok: false, error: `Currency must be one of ${CURRENCIES.join(", ")}.` };
  }

  const cycle = field(form, "cycle");
  if (!isOneOf(CYCLES, cycle)) return { ok: false, error: "Billing cycle must be monthly or yearly." };

  const newCategory = field(form, "new_category").trim();
  if (newCategory.length > 0) {
    if (newCategory.length > CATEGORY_NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: `Category name must be at most ${String(CATEGORY_NAME_MAX_LENGTH)} characters.`,
      };
    }
    return { ok: true, value: { name, amount, currency, cycle, categoryId: null, newCategory } };
  }

  const categoryId = field(form, "category_id");
  if (!UUID_PATTERN.test(categoryId)) return { ok: false, error: "Choose a category." };

  return { ok: true, value: { name, amount, currency, cycle, categoryId, newCategory: null } };
}

function logDbError(operation: string, error: { code: string; message: string }) {
  // Only the Supabase error code and message — never user-entered form values.
  // Intentional: Worker logs / `wrangler tail` are where save failures become visible.
  // eslint-disable-next-line no-console
  console.error(`[subscriptions] ${operation} failed`, { code: error.code, message: error.message });
}

/** Finds a visible (starter or own) category by exact, case-insensitive name; no SQL pattern matching. */
async function findVisibleCategoryId(supabase: Client, name: string): Promise<Result<string | null>> {
  const { data, error } = await supabase.from("categories").select("id, name");
  if (error) {
    logDbError("load categories", error);
    return { ok: false, error: SAVE_ERROR };
  }
  const wanted = name.toLowerCase();
  const match = data.find((category) => category.name.toLowerCase() === wanted);
  return { ok: true, value: match?.id ?? null };
}

async function resolveNewCategory(supabase: Client, userId: string, name: string): Promise<Result<string>> {
  const existing = await findVisibleCategoryId(supabase, name);
  if (!existing.ok) return existing;
  if (existing.value) return { ok: true, value: existing.value };

  const { data, error } = await supabase.from("categories").insert({ name, user_id: userId }).select("id").single();
  if (!error) return { ok: true, value: data.id };

  if (error.code === "23505") {
    // Created concurrently (or matched by Postgres lower() but not JS toLowerCase()); reuse it.
    const retry = await findVisibleCategoryId(supabase, name);
    if (!retry.ok) return retry;
    if (retry.value) return { ok: true, value: retry.value };
  }
  logDbError("insert category", error);
  return { ok: false, error: SAVE_ERROR };
}

export async function createSubscription(
  supabase: Client,
  userId: string,
  input: NewSubscriptionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let categoryId = input.categoryId;
  if (input.newCategory) {
    const resolved = await resolveNewCategory(supabase, userId, input.newCategory);
    if (!resolved.ok) return resolved;
    categoryId = resolved.value;
  }
  if (!categoryId) return { ok: false, error: "Choose a category." };

  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    name: input.name,
    // The generated type is `number`. The amount is validated to at most 10 significant digits,
    // which a double represents exactly and serialises back to the same decimal text in JSON,
    // so numeric(10,2) receives the value the user entered.
    amount: Number(input.amount),
    currency: input.currency,
    cycle: input.cycle,
    category_id: categoryId,
  });
  if (error) {
    logDbError("insert subscription", error);
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

/** The current user's subscriptions (RLS scopes the rows), newest first. */
export async function listSubscriptions(supabase: Client): Promise<SubscriptionListItemDTO[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    // amount is cast to text in PostgREST so the exact decimal never passes through a float.
    .select("id, name, amount:amount::text, currency, cycle, created_at, category:categories(name)")
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("list subscriptions", error);
    throw new Error("Could not load subscriptions.");
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency as Currency,
    cycle: row.cycle as Cycle,
    categoryName: row.category.name,
    createdAt: row.created_at,
  }));
}

/** Categories visible to the current user: starters first, then own, each alphabetical. */
export async function listCategories(supabase: Client): Promise<CategoryDTO[]> {
  const { data, error } = await supabase.from("categories").select("id, name, user_id");
  if (error) {
    logDbError("list categories", error);
    throw new Error("Could not load categories.");
  }
  return data
    .map((row) => ({ id: row.id, name: row.name, isStarter: row.user_id === null }))
    .sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
}
