import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { findLiterals, toRepoPath } from "./ui-literals-check.mjs";

test("palette class is a hit", () => {
  assert.deepEqual(findLiterals('<a class="text-purple-300 hover:underline">'), ["text-purple"]);
});

test("white with an opacity modifier is a hit", () => {
  assert.deepEqual(findLiterals('<div class="bg-white/10 p-4">'), ["bg-white"]);
});

test("hex colour is a hit", () => {
  assert.deepEqual(findLiterals("color: #0a0e1a;"), ["#0a0e1a"]);
});

test("arbitrary length is a hit", () => {
  assert.deepEqual(findLiterals('<div class="w-[320px] h-[2.5rem]">'), ["-[320px]", "-[2.5rem]"]);
});

test("oklch and rgba are hits", () => {
  assert.deepEqual(findLiterals("oklch(1 0 0) rgba(0,0,0,.5)"), ["oklch(", "rgba("]);
});

test("token classes pass", () => {
  assert.deepEqual(
    findLiterals('<p class="bg-primary text-muted-foreground text-link border-border ring-ring/50">'),
    [],
  );
});

test("scope-like prefixes are not palette classes", () => {
  assert.deepEqual(findLiterals('<div class="text-heading bg-cosmic bg-background-highlight">'), []);
});

test("absolute argument is normalised to a repo path", () => {
  const root = path.resolve("repo");
  assert.equal(toRepoPath(path.join(root, "src", "layouts", "Layout.astro"), root), "src/layouts/Layout.astro");
});

test("relative argument is normalised to a repo path", () => {
  const root = path.resolve("repo");
  assert.equal(toRepoPath("src/components/Topbar.astro", root), "src/components/Topbar.astro");
});
