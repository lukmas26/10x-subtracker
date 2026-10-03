import React, { useState } from "react";
import { Banknote, Coins, FolderPlus, Repeat, Save, Tag, Tags } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { SelectField } from "@/components/subscriptions/SelectField";
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
} from "@/types";

/** Select value for the "+ New category…" option; never a valid uuid, so the server ignores it. */
const NEW_CATEGORY = "__new__";

const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", yearly: "Yearly" };

interface Props {
  categories: CategoryDTO[];
  serverError?: string | null;
}

type Errors = Partial<Record<"name" | "amount" | "category" | "newCategory", string>>;

export default function SubscriptionForm({ categories, serverError }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const isNewCategory = categoryId === NEW_CATEGORY;

  function validate() {
    const next: Errors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      next.name = "Name is required";
    } else if (trimmedName.length > SUBSCRIPTION_NAME_MAX_LENGTH) {
      next.name = `Name must be at most ${String(SUBSCRIPTION_NAME_MAX_LENGTH)} characters`;
    }

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      next.amount = "Amount is required";
    } else if (!AMOUNT_PATTERN.test(trimmedAmount)) {
      next.amount = "Use a number with up to 2 decimal places, e.g. 49.99";
    } else if (!(Number(normaliseAmount(trimmedAmount)) > 0)) {
      next.amount = "Amount must be greater than 0";
    }

    if (isNewCategory) {
      const trimmedCategory = newCategory.trim();
      if (!trimmedCategory) {
        next.newCategory = "Category name is required";
      } else if (trimmedCategory.length > CATEGORY_NAME_MAX_LENGTH) {
        next.newCategory = `Category name must be at most ${String(CATEGORY_NAME_MAX_LENGTH)} characters`;
      }
    } else if (!categoryId) {
      next.category = "Choose a category";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof Errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/subscriptions" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label="Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="e.g. Netflix"
        error={errors.name}
        icon={<Tag className="size-4" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField
          id="amount"
          label="Amount"
          inputMode="decimal"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            clearError("amount");
          }}
          placeholder="49.99"
          error={errors.amount}
          icon={<Banknote className="size-4" />}
        />
        <SelectField
          id="currency"
          label="Currency"
          value={currency}
          onChange={(v) => {
            setCurrency(v as Currency);
          }}
          icon={<Coins className="size-4" />}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </div>

      <SelectField
        id="cycle"
        label="Billing cycle"
        value={cycle}
        onChange={(v) => {
          setCycle(v as Cycle);
        }}
        icon={<Repeat className="size-4" />}
      >
        {CYCLES.map((c) => (
          <option key={c} value={c}>
            {CYCLE_LABELS[c]}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="category_id"
        label="Category"
        value={categoryId}
        onChange={(v) => {
          setCategoryId(v);
          clearError("category");
          clearError("newCategory");
        }}
        error={errors.category}
        icon={<Tags className="size-4" />}
      >
        <option value="" disabled>
          Choose a category
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ New category…</option>
      </SelectField>

      {isNewCategory && (
        <FormField
          id="new_category"
          label="New category name"
          value={newCategory}
          onChange={(v) => {
            setNewCategory(v);
            clearError("newCategory");
          }}
          placeholder="e.g. Video"
          error={errors.newCategory}
          icon={<FolderPlus className="size-4" />}
        />
      )}

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />}>
        Add subscription
      </SubmitButton>
    </form>
  );
}
