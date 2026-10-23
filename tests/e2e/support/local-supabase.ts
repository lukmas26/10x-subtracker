import { expect, type APIRequestContext } from "@playwright/test";

// Test-data cleanup through the local Supabase REST API. Users cannot delete their
// subscriptions (no route, no delete grant), so cleanup uses the local service-role key.
// Refuses anything but a local stack: E2E data must never be written to or deleted from
// a hosted project.
function localAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY (SERVICE_ROLE_KEY from `npx supabase status -o env`) in .env",
    );
  }
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E cleanup only runs against a local Supabase, not ${hostname}`);
  }
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

function subscriptionsByName(url: string, name: string) {
  const endpoint = new URL("/rest/v1/subscriptions", url);
  endpoint.searchParams.set("name", `eq.${name}`);
  return endpoint.toString();
}

// Deletes every subscription with this exact name and asserts none is left.
export async function deleteSubscriptionsNamed(request: APIRequestContext, name: string) {
  const { url, headers } = localAdmin();
  const deleted = await request.delete(subscriptionsByName(url, name), { headers });
  await expect(deleted).toBeOK();

  const left = await request.get(subscriptionsByName(url, name), { headers });
  await expect(left).toBeOK();
  expect(await left.json()).toEqual([]);
}
