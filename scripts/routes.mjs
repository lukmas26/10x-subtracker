// Route inventory: every file under src/pages/ and how an anonymous request to it must be answered.
// `scripts/routes.test.mjs` fails when a route file is missing here; `scripts/smoke.mjs` turns each
// protected entry into an anonymous step. Classify every new route file in this list.

// Fixed valid UUID for dynamic segments: the auth check must answer before any lookup happens.
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

const toSignin = { status: 302, path: "/auth/signin" };

// A valid subscription form: if the auth check were removed, the request would reach the RPC and the break
// would show up as a different response instead of the signin redirect.
const subscriptionForm = {
  name: "Smoke-Anon",
  amount: "1",
  currency: "PLN",
  cycle: "monthly",
  category_id: "__new__",
  new_category: "Smoke",
};

/**
 * @typedef {{
 *   file: string,
 *   access: "public" | "protected" | "dev-only",
 *   method?: "GET" | "POST",
 *   path?: string,
 *   form?: Record<string, string>,
 *   anonymous?: { status: number, path: string },
 * }} Route
 */

/** @type {Route[]} */
export const ROUTES = [
  { file: "index.astro", access: "public" },
  { file: "auth/signin.astro", access: "public" },
  { file: "auth/signup.astro", access: "public" },
  { file: "auth/confirm-email.astro", access: "public" },
  { file: "api/auth/signin.ts", access: "public" },
  { file: "api/auth/signup.ts", access: "public" },
  { file: "api/auth/signout.ts", access: "public" },
  { file: "dev/kitchen-sink.astro", access: "dev-only" },
  { file: "dashboard.astro", access: "protected", method: "GET", path: "/dashboard", anonymous: toSignin },
  { file: "subscriptions.astro", access: "protected", method: "GET", path: "/subscriptions", anonymous: toSignin },
  {
    file: "subscriptions/[id]/edit.astro",
    access: "protected",
    method: "GET",
    path: `/subscriptions/${SAMPLE_ID}/edit`,
    anonymous: toSignin,
  },
  {
    file: "api/subscriptions.ts",
    access: "protected",
    method: "POST",
    path: "/api/subscriptions",
    form: subscriptionForm,
    anonymous: toSignin,
  },
  {
    file: "api/subscriptions/[id].ts",
    access: "protected",
    method: "POST",
    path: `/api/subscriptions/${SAMPLE_ID}`,
    form: subscriptionForm,
    anonymous: toSignin,
  },
];
