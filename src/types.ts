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
