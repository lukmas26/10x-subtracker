import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksAnonymous, matches } from "./smoke-match.mjs";

const BASE = "http://localhost:4321";
const home = { status: 302, path: "/" };
const signin = { status: 302, path: "/auth/signin" };
const signinError = { status: 302, path: "/auth/signin", error: true };

test("error redirect does not match a home redirect (prefix false pass)", () => {
  assert.equal(matches({ status: 302, location: "/auth/signin?error=x" }, home, BASE), false);
});

test("home redirect matches home", () => {
  assert.equal(matches({ status: 302, location: "/" }, home, BASE), true);
});

test("signin with error matches an expected error", () => {
  assert.equal(matches({ status: 302, location: "/auth/signin?error=Invalid" }, signinError, BASE), true);
});

test("signin without error does not match an expected error", () => {
  assert.equal(matches({ status: 302, location: "/auth/signin" }, signinError, BASE), false);
});

test("signin with empty error does not match an expected error", () => {
  assert.equal(matches({ status: 302, location: "/auth/signin?error=" }, signinError, BASE), false);
});

test("signin with error does not match when no error is expected", () => {
  assert.equal(matches({ status: 302, location: "/auth/signin?error=x" }, signin, BASE), false);
});

test("path must match exactly, not by prefix", () => {
  assert.equal(matches({ status: 302, location: "/auth/signinx" }, signin, BASE), false);
});

test("absolute same-origin location matches", () => {
  assert.equal(matches({ status: 302, location: `${BASE}/auth/signin` }, signin, BASE), true);
});

test("foreign-origin location with the right path does not match", () => {
  assert.equal(matches({ status: 302, location: "https://evil.example.com/auth/signin" }, signin, BASE), false);
});

test("wrong status fails even with the right path", () => {
  assert.equal(matches({ status: 303, location: "/auth/signin" }, signin, BASE), false);
});

test("status-only expectation ignores location", () => {
  assert.equal(matches({ status: 200, location: "" }, { status: 200 }, BASE), true);
  assert.equal(matches({ status: 500, location: "" }, { status: 200 }, BASE), false);
});

test("body: bodyIncludes passes when the body contains the string", () => {
  assert.equal(
    matches(
      { status: 200, location: "", body: "<p>Smoke-Sub-1</p>" },
      { status: 200, bodyIncludes: "Smoke-Sub-1" },
      BASE,
    ),
    true,
  );
});

test("body: bodyIncludes fails when the body lacks the string", () => {
  assert.equal(
    matches({ status: 200, location: "", body: "<p>Other</p>" }, { status: 200, bodyIncludes: "Smoke-Sub-1" }, BASE),
    false,
  );
});

test("body: bodyExcludes passes when the body lacks the string", () => {
  assert.equal(
    matches({ status: 200, location: "", body: "<p>Other</p>" }, { status: 200, bodyExcludes: "Smoke-Sub-1" }, BASE),
    true,
  );
});

test("body: bodyExcludes fails when the body contains the string", () => {
  assert.equal(
    matches(
      { status: 200, location: "", body: "<p>Smoke-Sub-1</p>" },
      { status: 200, bodyExcludes: "Smoke-Sub-1" },
      BASE,
    ),
    false,
  );
});

test("body: a body expectation with no body fails", () => {
  assert.equal(matches({ status: 200, location: "" }, { status: 200, bodyIncludes: "x" }, BASE), false);
  assert.equal(matches({ status: 200, location: "" }, { status: 200, bodyExcludes: "x" }, BASE), false);
});

test("body: checked after status and redirect rules", () => {
  assert.equal(matches({ status: 500, location: "", body: "x" }, { status: 200, bodyIncludes: "x" }, BASE), false);
  assert.equal(
    matches({ status: 302, location: "/auth/signin?error=x", body: "x" }, { ...signin, bodyIncludes: "x" }, BASE),
    false,
  );
});

const PREVIEW = "https://preview.example.workers.dev";

test("access: 401 and 403 count as blocked", () => {
  assert.equal(blocksAnonymous({ status: 401, location: "" }, PREVIEW), true);
  assert.equal(blocksAnonymous({ status: 403, location: "" }, PREVIEW), true);
});

test("access: 302 to a cloudflareaccess.com host counts as blocked", () => {
  const location = "https://team.cloudflareaccess.com/cdn-cgi/access/login/preview.example.workers.dev";
  assert.equal(blocksAnonymous({ status: 302, location }, PREVIEW), true);
});

test("access: 200 from the app is not blocked", () => {
  assert.equal(blocksAnonymous({ status: 200, location: "" }, PREVIEW), false);
});

test("access: 302 to an app path or look-alike host is not blocked", () => {
  assert.equal(blocksAnonymous({ status: 302, location: "/auth/signin" }, PREVIEW), false);
  assert.equal(
    blocksAnonymous({ status: 302, location: "https://cloudflareaccess.com.evil.example/" }, PREVIEW),
    false,
  );
  assert.equal(blocksAnonymous({ status: 302, location: "" }, PREVIEW), false);
});
