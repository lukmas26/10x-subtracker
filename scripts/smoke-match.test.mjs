import { test } from "node:test";
import assert from "node:assert/strict";
import { matches } from "./smoke-match.mjs";

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
