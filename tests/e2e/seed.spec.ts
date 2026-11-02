// Seed — protects risk #5 (context/foundation/test-plan.md §2): an anonymous visitor
// reaches a protected page. Every generated E2E test copies this file's patterns.
import { test, expect } from "@playwright/test";

const PROTECTED_PAGES = ["/dashboard", "/subscriptions"];

test.describe("signed-out visitor", () => {
  // This risk is the signed-out path, so opt out of the saved session.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of PROTECTED_PAGES) {
    test(`anonymous visitor opening ${path} is sent to sign-in instead of seeing the page`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL("/auth/signin");
      await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
      // Creates no data: nothing to clean up.
    });
  }
});

test("signed-in user opening /subscriptions sees the page, not the sign-in redirect", async ({ page }) => {
  // Counterpart to the redirect above: the gate lets a session through, so the
  // redirect is proven to depend on the missing session, not on the route.
  await page.goto("/subscriptions");

  await expect(page).toHaveURL("/subscriptions");
  await expect(page.getByRole("heading", { name: "Add a subscription" })).toBeVisible();
  // Read-only: nothing to clean up. Never sign out here, it would revoke the shared session.
});
