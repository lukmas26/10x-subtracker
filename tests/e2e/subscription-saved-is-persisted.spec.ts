// risk: test-plan.md #4 — the user sees a "saved" confirmation although nothing was persisted
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForIslands } from "./support/hydration";
import { deleteSubscriptionsNamed } from "./support/local-supabase";

test.describe("risk #4: a saved confirmation means the subscription really exists", () => {
  let name: string | undefined;

  test.afterEach(async ({ request }) => {
    expect(name, "the test set its data token").toBeDefined();
    if (name) await deleteSubscriptionsNamed(request, name);
  });

  test("subscription confirmed as saved is still on the list after a fresh page load", async ({ page }, testInfo) => {
    name = `E2E saved ${Date.now()}-${testInfo.workerIndex}`;
    testInfo.annotations.push({ type: "test-data", description: name });

    // Open the add form and wait until the React form is interactive.
    await page.goto("/subscriptions");
    await waitForIslands(page);

    // Add a subscription with a unique name in a shared category (creates no category row).
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("textbox", { name: "Amount" }).fill("12.50");
    await page.getByLabel("Category").selectOption("Other");
    await page.getByRole("button", { name: "Add subscription" }).click();

    // The app confirms the save.
    await expect(page).toHaveURL("/subscriptions?saved=1");
    await expect(page.getByRole("status")).toHaveText("Subscription saved");

    // A fresh load, without the ?saved flag, renders the list from the database:
    // exactly one row with the values that were entered.
    await page.goto("/subscriptions");
    await expect(page.getByRole("status")).toHaveCount(0);
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("12.50 PLN · monthly · Other");
  });
});
