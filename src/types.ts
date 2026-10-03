// Shared entity/DTO types for the service layer, API routes and components.

export const CURRENCIES = ["PLN", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CYCLES = ["monthly", "yearly"] as const;
export type Cycle = (typeof CYCLES)[number];

export interface CategoryDTO {
  id: string;
  name: string;
  /** Starter categories are shared by everyone (no owner); the rest belong to the current user. */
  isStarter: boolean;
}

export interface SubscriptionListItemDTO {
  id: string;
  name: string;
  /** Exact decimal string as stored (e.g. "49.99"); never converted to a float. */
  amount: string;
  currency: Currency;
  cycle: Cycle;
  categoryName: string;
  createdAt: string;
}

// Validation limits shared by the server (src/lib/services/subscriptions.ts) and the form island.
// Kept here (no server-only imports) so the client bundle can use them safely.
export const SUBSCRIPTION_NAME_MAX_LENGTH = 100;
export const CATEGORY_NAME_MAX_LENGTH = 50;
/** Up to 8 integer digits and 2 decimals (numeric(10,2)); dot or comma as decimal separator. */
export const AMOUNT_PATTERN = /^\d{1,8}([.,]\d{1,2})?$/;

/** Normalises a user-entered amount ("49,99") to the canonical decimal string ("49.99"). */
export function normaliseAmount(raw: string): string {
  return raw.trim().replace(",", ".");
}
