// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// Remote mode (existing confirmed account, no sign-up): set SMOKE_EMAIL + SMOKE_PASSWORD, optionally
// CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET and SMOKE_EXPECT_ACCESS=1 (see `npm run smoke:remote`).

import { blocksAnonymous, matches } from "./smoke-match.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const { SMOKE_EMAIL, SMOKE_PASSWORD, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, SMOKE_EXPECT_ACCESS } = process.env;

function abort(message) {
  console.error(`smoke: ${message}`);
  process.exit(1);
}

if (Boolean(SMOKE_EMAIL) !== Boolean(SMOKE_PASSWORD)) {
  abort("SMOKE_EMAIL and SMOKE_PASSWORD must both be set (remote mode) or both be unset (local mode).");
}
if (Boolean(CF_ACCESS_CLIENT_ID) !== Boolean(CF_ACCESS_CLIENT_SECRET)) {
  abort("CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must both be set or both be unset.");
}
const expectAccess = SMOKE_EXPECT_ACCESS === "1";
if (expectAccess && !CF_ACCESS_CLIENT_ID) {
  abort("SMOKE_EXPECT_ACCESS=1 requires CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.");
}

const remote = Boolean(SMOKE_EMAIL);
const email = remote ? SMOKE_EMAIL : `smoke-${Date.now()}@example.com`;
const password = remote ? SMOKE_PASSWORD : "Smoke-Test-Passw0rd!";
const accessHeaders = CF_ACCESS_CLIENT_ID
  ? { "CF-Access-Client-Id": CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": CF_ACCESS_CLIENT_SECRET }
  : {};
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      ...accessHeaders,
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

// No Access headers, no cookie jar (read or write): a stale CF_Authorization cookie must not make this pass.
async function anonymousRequest(path) {
  const response = await fetch(BASE_URL + path, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

const signinSteps = [
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, path: "/auth/signin", error: true },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, path: "/" },
  ],
];

const steps = [
  ...(expectAccess
    ? [["preview blocks anonymous request", () => anonymousRequest("/"), { check: blocksAnonymous }]]
    : []),
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, path: "/auth/signin" }],
  ...(remote
    ? []
    : [
        [
          "signup creates account",
          () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
          { status: 302, path: "/auth/confirm-email" },
        ],
      ]),
  ...signinSteps,
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, path: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, path: "/auth/signin" }],
];

console.log(`mode: ${remote ? "remote" : "local"}  BASE_URL: ${BASE_URL}${expectAccess ? "  (expecting Access)" : ""}`);

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok = expected.check ? expected.check(actual, BASE_URL) : matches(actual, expected, BASE_URL);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(
      `      expected ${expected.check ? "401/403 or 302 to *.cloudflareaccess.com" : JSON.stringify(expected)}`,
    );
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
