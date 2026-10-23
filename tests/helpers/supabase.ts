// Integration helpers: a typed port of the scripts/rls-check.mjs patterns.
// Local Supabase only: tests sign up throwaway users. Never point them at hosted Supabase.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

// Enforce "local only": against hosted Supabase each run would leave throwaway users in the shared database.
const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];
const PASSWORD = "Vitest-Check-Passw0rd!";

/** A per-run unique suffix for throwaway emails and names. */
export const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function readEnv(): { url: string; key: string } {
  const { SUPABASE_URL, SUPABASE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "integration tests: SUPABASE_URL and SUPABASE_KEY must be set (local Supabase API URL and anon key).",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

/** Throws unless SUPABASE_URL/SUPABASE_KEY are set and the URL points at a local host. */
export function assertLocalSupabase(): void {
  const { url } = readEnv();
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // Fall through: an unparseable URL is not a local one.
  }
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`integration tests: refusing to run against "${host || url}" — local Supabase only.`);
  }
}

export interface NewClientOptions {
  /** Replaces the client's fetch, e.g. to fail or observe specific requests. */
  fetch?: typeof fetch;
}

export function newClient(options: NewClientOptions = {}): SupabaseClient<Database> {
  const { url, key } = readEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });
}

/** Signs up a throwaway user; the returned client is signed in as that user. */
export async function signUpUser(label: string): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = newClient();
  const email = `vitest-${label}-${runId}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error || !data.session || !data.user) {
    const reason = error ? error.message : "no session returned (are email confirmations enabled?)";
    throw new Error(`sign-up of user ${label} failed: ${reason}`);
  }
  return { client, userId: data.user.id };
}
