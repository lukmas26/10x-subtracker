import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROUTES } from "./routes.mjs";

// Resolved from this file, not the cwd, so the test works from any directory.
const PAGES_DIR = fileURLToPath(new URL("../src/pages/", import.meta.url));
const HINT = "classify it in scripts/routes.mjs";

function routeFiles() {
  return (
    readdirSync(PAGES_DIR, { recursive: true })
      .map((entry) => String(entry).replaceAll("\\", "/"))
      // Every extension Astro turns into a route; a "_" segment is not routed, so it needs no entry.
      .filter((entry) => /\.(astro|ts|js|md|mdx|html)$/.test(entry))
      .filter((entry) => !entry.split("/").some((segment) => segment.startsWith("_")))
      .sort()
  );
}

test("every route file under src/pages has exactly one entry", () => {
  for (const file of routeFiles()) {
    const count = ROUTES.filter((route) => route.file === file).length;
    assert.equal(count, 1, `src/pages/${file} has ${String(count)} entries in ROUTES; ${HINT} exactly once`);
  }
});

test("every entry's file exists", () => {
  for (const route of ROUTES) {
    assert.ok(
      existsSync(PAGES_DIR + route.file),
      `src/pages/${route.file} is listed in ROUTES but does not exist; remove or fix it in scripts/routes.mjs`,
    );
  }
});

test("every entry has a known access level", () => {
  for (const route of ROUTES) {
    assert.ok(
      ["public", "protected", "dev-only"].includes(route.access),
      `src/pages/${route.file} has access "${String(route.access)}"; ${HINT} as public, protected or dev-only`,
    );
  }
});

test("every protected entry has method, path and anonymous expectation", () => {
  for (const route of ROUTES.filter((r) => r.access === "protected")) {
    assert.ok(route.method, `src/pages/${route.file} is protected but has no method; add it in scripts/routes.mjs`);
    assert.ok(route.path, `src/pages/${route.file} is protected but has no path; add it in scripts/routes.mjs`);
    assert.ok(
      route.anonymous,
      `src/pages/${route.file} is protected but has no anonymous expectation; add it in scripts/routes.mjs`,
    );
  }
});

test("no path duplicates another", () => {
  const seen = new Map();
  for (const route of ROUTES.filter((r) => r.path !== undefined)) {
    assert.ok(
      !seen.has(route.path),
      `src/pages/${route.file} reuses path ${route.path} of src/pages/${seen.get(route.path)}; fix it in scripts/routes.mjs`,
    );
    seen.set(route.path, route.file);
  }
});
