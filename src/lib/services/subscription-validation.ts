// The subscription form's client-side rule set, as a pure function so it can be tested without rendering.
// Imports only from @/types (no server-only modules), so the form island can bundle it safely.
import { AMOUNT_PATTERN, CATEGORY_NAME_MAX_LENGTH, SUBSCRIPTION_NAME_MAX_LENGTH, normaliseAmount } from "@/types";

/** Select value for the "+ New category…" option; never a valid uuid, so the server ignores it. */
export const NEW_CATEGORY = "__new__";

export type Errors = Partial<Record<"name" | "amount" | "category" | "newCategory", string>>;

/** The form's field values as typed; currency and cycle are select-only and not validated here. */
export interface SubscriptionFormValues {
  name: string;
  amount: string;
  categoryId: string;
  newCategory: string;
  /** Whether "+ New category…" is selected, so `newCategory` is required instead of `categoryId`. */
  isNewCategory: boolean;
}

/** Per-field error messages for the form; an empty object means the form may submit. */
export function validateSubscriptionForm(values: SubscriptionFormValues): Errors {
  const next: Errors = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    next.name = "Name is required";
  } else if (trimmedName.length > SUBSCRIPTION_NAME_MAX_LENGTH) {
    next.name = `Name must be at most ${String(SUBSCRIPTION_NAME_MAX_LENGTH)} characters`;
  }

  const trimmedAmount = values.amount.trim();
  if (!trimmedAmount) {
    next.amount = "Amount is required";
  } else if (!AMOUNT_PATTERN.test(trimmedAmount)) {
    next.amount = "Use a number with up to 2 decimal places, e.g. 49.99";
  } else if (!(Number(normaliseAmount(trimmedAmount)) > 0)) {
    next.amount = "Amount must be greater than 0";
  }

  if (values.isNewCategory) {
    const trimmedCategory = values.newCategory.trim();
    if (!trimmedCategory) {
      next.newCategory = "Category name is required";
    } else if (trimmedCategory.length > CATEGORY_NAME_MAX_LENGTH) {
      next.newCategory = `Category name must be at most ${String(CATEGORY_NAME_MAX_LENGTH)} characters`;
    }
  } else if (!values.categoryId) {
    next.category = "Choose a category";
  }

  return next;
}
