/// <reference types="vitest/config" />
// Vitest runs through Astro's Vite config, so the `@/` alias and `astro:*` virtual modules
// (e.g. `astro:env/server`) resolve in tests exactly as they do in the app.
import { getViteConfig } from "astro/config";
import type { PluginOption, UserConfig } from "vite";

const astroViteConfig = getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Refuses to start unless SUPABASE_URL/SUPABASE_KEY point at a local Supabase.
          globalSetup: ["tests/helpers/global-setup.ts"],
          // All integration files share one local database; run them one at a time.
          fileParallelism: false,
          // beforeAll blocks sign up 2–3 users; give a cold local auth stack more than the 10s default.
          hookTimeout: 30_000,
        },
      },
    ],
  },
});

// The Cloudflare adapter's dev plugins move module execution into a workerd runner, which Vitest
// cannot drive ("module is not defined"). Tests run in Node, so drop them; Astro's own plugins stay.
const CLOUDFLARE_PLUGIN = /^(vite-plugin-cloudflare|@astrojs\/cloudflare)/;

// A plugin option may be a promise or a nested array; resolve both so every plugin has a name to match.
async function flattenPlugins(options: PluginOption[]): Promise<PluginOption[]> {
  const flat: PluginOption[] = [];
  for (const option of options) {
    const resolved = await option;
    if (Array.isArray(resolved)) {
      flat.push(...(await flattenPlugins(resolved)));
    } else {
      flat.push(resolved);
    }
  }
  return flat;
}

async function withoutCloudflare(plugins: PluginOption[]): Promise<PluginOption[]> {
  return (await flattenPlugins(plugins)).filter((plugin) => {
    return !(plugin && "name" in plugin && CLOUDFLARE_PLUGIN.test(plugin.name));
  });
}

// The Cloudflare adapter also copies .dev.vars (or .env) into process.env while Astro resolves its config.
// Tests read SUPABASE_URL/SUPABASE_KEY from the shell only, like `npm run test:rls`, so the local-only
// guard fails when they are unset; undo whatever the config step added or changed.
function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      Reflect.deleteProperty(process.env, key);
    }
  }
  Object.assign(process.env, snapshot);
}

export default async (env: { mode: string; command: "build" | "serve" }): Promise<UserConfig> => {
  const snapshot = { ...process.env };
  const config = await astroViteConfig(env);
  restoreEnv(snapshot);
  return { ...config, plugins: await withoutCloudflare(config.plugins ?? []) };
};
