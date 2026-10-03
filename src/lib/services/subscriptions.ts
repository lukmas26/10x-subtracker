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

/** Every message the add-subscription flow can show; `/subscriptions` displays `?error=` only if it is one of these. */
export const SUBSCRIPTION_ERRORS = {
  notConfigured: "Supabase is not configured",
  nameRequired: "Name is required.",
  nameTooLong: `Name must be at most ${String(SUBSCRIPTION_NAME_MAX_LENGTH)} characters.`,
  amountFormat: "Amount must be a number with up to 2 decimal places, e.g. 49.99.",
  amountNotPositive: "Amount must be greater than 0.",
  currency: `Currency must be one of ${CURRENCIES.join(", ")}.`,
  cycle: "Billing cycle must be monthly or yearly.",
  categoryTooLong: `Category name must be at most ${String(CATEGORY_NAME_MAX_LENGTH)} characters.`,
  chooseCategory: "Choose a category.",
  save: "Could not save the subscription. Please try again.",
} as const;

const KNOWN_ERRORS: ReadonlySet<string> = new Set(Object.values(SUBSCRIPTION_ERRORS));
const UNKNOWN_ERROR = "Something went wrong. Please try again.";

/** Maps a `?error=` value to what the page may show: known messages as-is, any other (crafted) text generic. */
export function displayableError(raw: string | null): string | null {
  if (!raw) return null;
  return KNOWN_ERRORS.has(raw) ? raw : UNKNOWN_ERROR;
}
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
  if (name.length === 0) return { ok: false, error: SUBSCRIPTION_ERRORS.nameRequired };
  if (name.length > SUBSCRIPTION_NAME_MAX_LENGTH) {
    return { ok: false, error: SUBSCRIPTION_ERRORS.nameTooLong };
  }

  const rawAmount = field(form, "amount").trim();
  if (!AMOUNT_PATTERN.test(rawAmount)) {
    return { ok: false, error: SUBSCRIPTION_ERRORS.amountFormat };
  }
  const amount = normaliseAmount(rawAmount);
  if (!(Number(amount) > 0)) return { ok: false, error: SUBSCRIPTION_ERRORS.amountNotPositive };

  const currency = field(form, "currency");
  if (!isOneOf(CURRENCIES, currency)) {
    return { ok: false, error: SUBSCRIPTION_ERRORS.currency };
  }

  const cycle = field(form, "cycle");
  if (!isOneOf(CYCLES, cycle)) return { ok: false, error: SUBSCRIPTION_ERRORS.cycle };

  const newCategory = field(form, "new_category").trim();
  if (newCategory.length > 0) {
    if (newCategory.length > CATEGORY_NAME_MAX_LENGTH) {
      return {
        ok: false,
        error: SUBSCRIPTION_ERRORS.categoryTooLong,
      };
    }
    return { ok: true, value: { name, amount, currency, cycle, categoryId: null, newCategory } };
  }

  const categoryId = field(form, "category_id");
  if (!UUID_PATTERN.test(categoryId)) return { ok: false, error: SUBSCRIPTION_ERRORS.chooseCategory };

  return { ok: true, value: { name, amount, currency, cycle, categoryId, newCategory: null } };
}

function logDbError(operation: string, error: { code: string; message: string }) {
  // Only the Supabase error code and message — never user-entered form values.
  // Intentional: Worker logs / `wrangler tail` are where save failures become visible.
  // eslint-disable-next-line no-console
  console.error(`[subscriptions] ${operation} failed`, { code: error.code, message: error.message });
}

/**
 * Saves the subscription for the signed-in user (the database takes the owner from `auth.uid()`).
 * One RPC call, one transaction: reusing or creating the category and inserting the subscription
 * succeed or fail together, so a failed save never leaves an orphan category behind.
 */
export async function createSubscription(
  supabase: Client,
  input: NewSubscriptionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.newCategory && !input.categoryId) return { ok: false, error: SUBSCRIPTION_ERRORS.chooseCategory };

  const { error } = await supabase.rpc("create_subscription", {
    p_name: input.name,
    // The generated type is `number`. The amount is validated to at most 10 significant digits,
    // which a double represents exactly and serialises back to the same decimal text in JSON,
    // so numeric(10,2) receives the value the user entered.
    p_amount: Number(input.amount),
    p_currency: input.currency,
    p_cycle: input.cycle,
    // A new category name takes precedence; the function reuses a visible one with the same name
    // (exact, case-insensitive) or creates it.
    ...(input.newCategory ? { p_new_category: input.newCategory } : { p_category_id: input.categoryId ?? undefined }),
  });
  if (error) {
    logDbError("create subscription", error);
    return { ok: false, error: SUBSCRIPTION_ERRORS.save };
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
