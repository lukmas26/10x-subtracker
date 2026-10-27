// risk: test-plan.md #4 — facet: an invalid entry shows an error and saves nothing; the
// corrected entry is then confirmed and really persisted. The plain happy path is covered by
// subscription-saved-is-persisted.spec.ts.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForIslands } from "./support/hydration";
import { deleteSubscriptionsNamed, findSubscriptionsNamed } from "./support/local-supabase";

test.describe("risk #4: feedback matches what was persisted", () => {
  let name: string | undefined;

  test.afterEach(async ({ request }) => {
    expect(name, "the test set its data token").toBeDefined();
    if (name) await deleteSubscriptionsNamed(request, name);
  });

  test("invalid amount shows an error and saves nothing; corrected amount is saved and listed", async ({
    page,
    request,
  }, testInfo) => {
    name = `E2E corrected ${Date.now()}-${testInfo.workerIndex}`;
    testInfo.annotations.push({ type: "test-data", description: name });

    // Open the add form and wait until the React form is interactive.
    await page.goto("/subscriptions");
    await waitForIslands(page);

    // Submit with an invalid amount (0) in a shared category (creates no category row).
    const amount = page.getByRole("textbox", { name: "Amount" });
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await amount.fill("0");
    await page.getByLabel("Category").selectOption("Other");
    await page.getByRole("button", { name: "Add subscription" }).click();

    // The amount field reports the error, and there is no saved confirmation.
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(amount).toHaveAccessibleDescription("Amount must be greater than 0");
    await expect(page).toHaveURL("/subscriptions");
    await expect(page.getByRole("status")).toHaveCount(0);

    // Nothing was stored for the rejected entry.
    expect(await findSubscriptionsNamed(request, name)).toEqual([]);

    // Correct the amount and submit again.
    await amount.fill("12.50");
    await page.getByRole("button", { name: "Add subscription" }).click();

    // The app confirms the save.
    await expect(page).toHaveURL("/subscriptions?saved=1");
    await expect(page.getByRole("status")).toHaveText("Subscription saved");

    // A fresh load renders the list from the database: exactly one row, with the corrected amount.
    await page.goto("/subscriptions");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("12.50 PLN · monthly · Other");
  });
});
