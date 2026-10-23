// The single oracle for risk #6 ("one rule set"): one case table, run against the form validator and
// the server parser (tests/unit/subscription-rules.test.ts) and against create_subscription
// (tests/integration/subscription-rules.db.test.ts).
//
// Expected verdicts come from the cited sources, never from running the code under test. When a run
// disagrees, find out which source is right; never edit a verdict to match the code. A real
// disagreement is either a documented divergence (with its reason) or a bug to raise.
//
// Sources:
// - PRD: context/foundation/prd.md:69-70 (name, amount, cycle and category are required)
// - S-01 plan: context/archive/2026-10-02-first-subscription-on-list/plan.md:72,157 (limits)
// - Roadmap: context/foundation/roadmap.md:133 (currencies PLN, EUR, USD)
// - Schema: supabase/migrations/20261003120000_subscriptions_and_categories.sql (DB checks, per row)
import { NEW_CATEGORY } from "@/lib/services/subscription-validation";

export type Verdict = "accept" | "reject";

/** The field a case is about; for a rejection it is also the only field the form flags. */
export type CaseField = "name" | "amount" | "currency" | "cycle" | "category" | "newCategory";

/** Raw form values, keyed by the names the form posts (`parseNewSubscription` reads these). */
export interface FormInput {
  name: string;
  amount: string;
  currency: string;
  cycle: string;
  category_id: string;
  new_category: string;
}

export interface SubscriptionCase {
  id: string;
  field: CaseField;
  input: FormInput;
  /** The app's verdict: the form validator and the server parser. */
  verdict: Verdict;
  /** Set when the form validator's verdict differs from `verdict` (e.g. select-only fields). */
  form?: { verdict: Verdict; reason: string };
  /** The database verdict when it differs from `verdict` or needs a specific error code. */
  db?: { verdict: Verdict; code?: string; reason: string };
  /** False for app-only inputs the database never receives from the app. */
  dbApplicable: boolean;
  /** Expected stored values for a layer that accepts; `category` is the new category's name, else the starter. */
  stored?: { name: string; amount: string; category?: string };
}

/**
 * Placeholder for "an existing starter category picked in the select" (a valid uuid shape, so the parser
 * accepts it). The DB test swaps it for the real id of {@link STARTER_CATEGORY_NAME}.
 */
export const STARTER_CATEGORY_ID = "00000000-0000-4000-8000-000000000001";
export const STARTER_CATEGORY_NAME = "Streaming";

/** A valid submission; each case changes only the field it is about. */
function form(overrides: Partial<FormInput> = {}): FormInput {
  return {
    name: "Netflix",
    amount: "9.99",
    currency: "PLN",
    cycle: "monthly",
    category_id: STARTER_CATEGORY_ID,
    new_category: "",
    ...overrides,
  };
}

function newCategory(name: string): Partial<FormInput> {
  return { category_id: NEW_CATEGORY, new_category: name };
}

const SUBSCRIPTIONS_SQL = "20261003120000_subscriptions_and_categories.sql";
const EMOJI = "\u{1F3AC}"; // one code point, two UTF-16 code units

export const subscriptionCases: readonly SubscriptionCase[] = [
  // Name. Required: prd.md:69-70. Trimmed, 1-100 chars: S-01 plan.md:72,157. DB check: migration :31.
  {
    id: "name-empty",
    field: "name",
    input: form({ name: "" }),
    verdict: "reject",
    db: { verdict: "reject", code: "23514", reason: `char_length(name) between 1 and 100 (${SUBSCRIPTIONS_SQL}:31)` },
    dbApplicable: true,
  },
  {
    id: "name-blank",
    field: "name",
    input: form({ name: "   " }),
    verdict: "reject",
    db: { verdict: "reject", code: "23514", reason: `btrim(p_name) is empty (${SUBSCRIPTIONS_SQL}:31)` },
    dbApplicable: true,
  },
  {
    id: "name-padded",
    field: "name",
    input: form({ name: " Netflix " }),
    verdict: "accept",
    dbApplicable: true,
    stored: { name: "Netflix", amount: "9.99" },
  },
  {
    id: "name-100-chars",
    field: "name",
    input: form({ name: "n".repeat(100) }),
    verdict: "accept",
    dbApplicable: true,
    stored: { name: "n".repeat(100), amount: "9.99" },
  },
  {
    id: "name-101-chars",
    field: "name",
    input: form({ name: "n".repeat(101) }),
    verdict: "reject",
    db: { verdict: "reject", code: "23514", reason: `char_length(name) between 1 and 100 (${SUBSCRIPTIONS_SQL}:31)` },
    dbApplicable: true,
  },

  // Amount. Required: prd.md:69-70. Up to 8 integer digits and 2 decimals, comma or dot, > 0:
  // S-01 plan.md:72,157. DB: numeric(10,2) check (amount > 0), migration :32.
  {
    id: "amount-missing",
    field: "amount",
    input: form({ amount: "" }),
    verdict: "reject",
    // App-only: the form stops an empty amount ("Amount is required") and the parser rejects it as a format error.
    dbApplicable: false,
  },
  {
    id: "amount-zero",
    field: "amount",
    input: form({ amount: "0" }),
    verdict: "reject",
    db: { verdict: "reject", code: "23514", reason: `check (amount > 0) (${SUBSCRIPTIONS_SQL}:32)` },
    dbApplicable: true,
  },
  {
    id: "amount-zero-decimals",
    field: "amount",
    input: form({ amount: "0.00" }),
    verdict: "reject",
    db: { verdict: "reject", code: "23514", reason: `check (amount > 0) (${SUBSCRIPTIONS_SQL}:32)` },
    dbApplicable: true,
  },
  {
    id: "amount-min",
    field: "amount",
    input: form({ amount: "0.01" }),
    verdict: "accept",
    dbApplicable: true,
    stored: { name: "Netflix", amount: "0.01" },
  },
  {
    id: "amount-comma",
    field: "amount",
    input: form({ amount: "49,99" }),
    verdict: "accept",
    // The DB receives the app's normalised amount, 49.99.
    dbApplicable: true,
    stored: { name: "Netflix", amount: "49.99" },
  },
  {
    id: "amount-max",
    field: "amount",
    input: form({ amount: "99999999.99" }),
    verdict: "accept",
    dbApplicable: true,
    stored: { name: "Netflix", amount: "99999999.99" },
  },
  {
    id: "amount-9-digits",
    field: "amount",
    input: form({ amount: "100000000" }),
    verdict: "reject",
    db: { verdict: "reject", code: "22003", reason: `numeric(10,2) overflow (${SUBSCRIPTIONS_SQL}:32)` },
    dbApplicable: true,
  },
  {
    id: "amount-text",
    field: "amount",
    input: form({ amount: "abc" }),
    verdict: "reject",
    db: { verdict: "reject", code: "22P02", reason: "not a numeric literal (p_amount numeric)" },
    dbApplicable: true,
  },
  {
    id: "amount-3-decimals",
    field: "amount",
    input: form({ amount: "1.999" }),
    verdict: "reject",
    db: {
      verdict: "accept",
      reason: `documented divergence: numeric(10,2) rounds 1.999 to 2.00 (${SUBSCRIPTIONS_SQL}:32); the app is the guard`,
    },
    dbApplicable: true,
    stored: { name: "Netflix", amount: "2.00" },
  },

  // Currency: PLN, EUR, USD only (roadmap.md:133; S-01 plan.md:72,157). DB check: migration :33.
  {
    id: "currency-gbp",
    field: "currency",
    input: form({ currency: "GBP" }),
    verdict: "reject",
    form: { verdict: "accept", reason: "select-only field: the form offers CURRENCIES and does not validate it" },
    db: { verdict: "reject", code: "23514", reason: `currency in ('PLN','EUR','USD') (${SUBSCRIPTIONS_SQL}:33)` },
    dbApplicable: true,
  },
  {
    id: "currency-lowercase",
    field: "currency",
    input: form({ currency: "pln" }),
    verdict: "reject",
    form: { verdict: "accept", reason: "select-only field: the form offers CURRENCIES and does not validate it" },
    db: { verdict: "reject", code: "23514", reason: `currency in ('PLN','EUR','USD') (${SUBSCRIPTIONS_SQL}:33)` },
    dbApplicable: true,
  },

  // Cycle: monthly or yearly (prd.md:69; S-01 plan.md:72,157). DB check: migration :34.
  {
    id: "cycle-weekly",
    field: "cycle",
    input: form({ cycle: "weekly" }),
    verdict: "reject",
    form: { verdict: "accept", reason: "select-only field: the form offers CYCLES and does not validate it" },
    db: { verdict: "reject", code: "23514", reason: `cycle in ('monthly','yearly') (${SUBSCRIPTIONS_SQL}:34)` },
    dbApplicable: true,
  },

  // Category. Required: prd.md:69-70. New category trimmed, 1-50 chars: S-01 plan.md:72,157.
  // DB: categories check :8; subscriptions.category_id not null :35 and the insert policy :72-84.
  {
    id: "category-new-50-chars",
    field: "newCategory",
    input: form(newCategory("c".repeat(50))),
    verdict: "accept",
    dbApplicable: true,
    stored: { name: "Netflix", amount: "9.99", category: "c".repeat(50) },
  },
  {
    id: "category-new-51-chars",
    field: "newCategory",
    input: form(newCategory("c".repeat(51))),
    verdict: "reject",
    db: {
      verdict: "reject",
      code: "23514",
      reason: `char_length(name) between 1 and 50 (${SUBSCRIPTIONS_SQL}:8); the whole call is rolled back`,
    },
    dbApplicable: true,
  },
  {
    id: "category-new-50-emoji",
    field: "newCategory",
    input: form(newCategory(EMOJI.repeat(50))),
    verdict: "reject",
    db: {
      verdict: "accept",
      reason:
        `documented divergence: JS .length counts UTF-16 code units (100), char_length counts code points (50) ` +
        `(${SUBSCRIPTIONS_SQL}:8); the app is stricter, never more permissive`,
    },
    dbApplicable: true,
    stored: { name: "Netflix", amount: "9.99", category: EMOJI.repeat(50) },
  },
  {
    id: "category-none",
    field: "category",
    input: form({ category_id: "" }),
    verdict: "reject",
    db: {
      verdict: "reject",
      // Not 23502 from `category_id uuid not null` (:35): Postgres checks RLS WITH CHECK before NOT NULL,
      // and the insert policy requires a visible category (exists ... c.id = category_id is false for null).
      code: "42501",
      reason: `insert policy requires a visible category (${SUBSCRIPTIONS_SQL}:72-84), checked before not null (:35)`,
    },
    dbApplicable: true,
  },
];
