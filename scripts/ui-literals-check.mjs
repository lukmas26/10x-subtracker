// UI literal check: fails when a scoped view uses a hardcoded colour or size instead of a token.
// Zero dependencies on purpose. The regex is the `/10x-ui` hardcoded-value scan.
// Usage: `npm run lint:ui` checks the whole scope; with file arguments (lint-staged) it checks
// only the arguments that are in scope and ignores the rest.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Views cleaned onto the design-system contract. Add a view here once it uses only tokens.
export const SCOPE = [
  "src/pages/subscriptions.astro",
  "src/components/subscriptions/SubscriptionForm.tsx",
  "src/components/form/FormField.tsx",
  "src/components/form/SelectField.tsx",
  "src/components/form/ServerError.tsx",
  "src/components/form/SubmitButton.tsx",
  "src/components/Topbar.astro",
  "src/layouts/Layout.astro",
  "src/components/Banner.astro",
  "src/components/ThemeToggle.tsx",
  "src/components/hooks/useTheme.ts",
  "src/pages/dev/kitchen-sink.astro",
  "src/components/dev/KitchenSinkFields.tsx",
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const LITERAL = new RegExp(
  String.raw`#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(` +
    PALETTE +
    String.raw`)\b`,
  "g",
);

/**
 * Hardcoded values found on one line.
 * @param {string} line
 * @returns {string[]}
 */
export function findLiterals(line) {
  return [...line.matchAll(LITERAL)].map((m) => m[0]);
}

/**
 * Repo-relative, forward-slash form of a path argument (absolute, relative, or Windows-style).
 * @param {string} arg
 * @param {string} root
 * @returns {string}
 */
export function toRepoPath(arg, root) {
  return path.relative(root, path.resolve(root, arg)).split(path.sep).join("/");
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const files = args.length === 0 ? SCOPE : args.map((a) => toRepoPath(a, root)).filter((f) => SCOPE.includes(f));
  let failed = false;

  for (const file of files) {
    const abs = path.join(root, file);
    if (!existsSync(abs)) {
      console.error(`${file}: scoped file not found (renamed? update SCOPE in scripts/ui-literals-check.mjs)`);
      failed = true;
      continue;
    }
    readFileSync(abs, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        for (const literal of findLiterals(line)) {
          console.error(`${file}:${i + 1}: ${literal}`);
          failed = true;
        }
      });
  }

  if (failed) {
    console.error("ui-literals: use a token from src/styles/global.css instead (see AGENTS.md, ## UI).");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
