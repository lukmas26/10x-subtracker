import type { Page } from "@playwright/test";

// Every Astro island has hydrated once no `astro-island[ssr]` is left. Wait for it before
// typing into a React form whose submit must not be retried (it creates data): input typed
// before hydration is lost.
export async function waitForIslands(page: Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}
