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
        },
      },
    ],
  },
});

// The Cloudflare adapter's dev plugins move module execution into a workerd runner, which Vitest
// cannot drive ("module is not defined"). Tests run in Node, so drop them; Astro's own plugins stay.
const CLOUDFLARE_PLUGIN = /^(vite-plugin-cloudflare|@astrojs\/cloudflare)/;

function withoutCloudflare(plugins: PluginOption[]): PluginOption[] {
  return plugins.flat(Infinity as 1).filter((plugin) => {
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
  return { ...config, plugins: withoutCloudflare(config.plugins ?? []) };
};
