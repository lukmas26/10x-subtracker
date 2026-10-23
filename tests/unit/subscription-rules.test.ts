// Risk #6: the case table run against the form validator and the server parser.
// Expected verdicts and values come from tests/cases/subscription-cases.ts only; no rule is re-implemented here.
import { describe, expect, it } from "vitest";

import { NEW_CATEGORY, validateSubscriptionForm } from "@/lib/services/subscription-validation";
import { parseNewSubscription } from "@/lib/services/subscriptions";

import { subscriptionCases, type FormInput } from "../cases/subscription-cases";

function toFormData(input: FormInput): FormData {
  const form = new FormData();
  const fields: Record<string, string> = { ...input };
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  return form;
}

describe("form validator (validateSubscriptionForm)", () => {
  it.each(subscriptionCases)("$id", (row) => {
    const errors = validateSubscriptionForm({
      name: row.input.name,
      amount: row.input.amount,
      categoryId: row.input.category_id,
      newCategory: row.input.new_category,
      isNewCategory: row.input.category_id === NEW_CATEGORY,
    });

    const verdict = row.form?.verdict ?? row.verdict;
    if (verdict === "accept") {
      expect(errors).toEqual({});
    } else {
      expect(Object.keys(errors)).toEqual([row.field]);
    }
  });
});

describe("server parser (parseNewSubscription)", () => {
  it.each(subscriptionCases)("$id", (row) => {
    const result = parseNewSubscription(toFormData(row.input));

    if (row.verdict === "reject") {
      expect(result.ok).toBe(false);
      return;
    }
    if (!result.ok) {
      throw new Error(`expected ${row.id} to be accepted, got "${result.error}"`);
    }
    if (!row.stored) {
      throw new Error(`case ${row.id} is accepted but has no expected stored values`);
    }
    expect(result.value.name).toBe(row.stored.name);
    expect(result.value.amount).toBe(row.stored.amount);
    expect(result.value.newCategory).toBe(row.stored.category ?? null);
  });
});
