// A minimal fake APIContext for calling the API routes' POST handlers directly, without a server.
// It provides only what the handlers read: locals, request, params and redirect().
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { APIContext } from "astro";

import type { Database } from "@/db/database.types";

export interface MakeContextOptions {
  supabase: SupabaseClient<Database> | null;
  user: User | null;
  form: Record<string, string>;
  params?: Record<string, string | undefined>;
}

export function makeContext({ supabase, user, form, params = {} }: MakeContextOptions): APIContext {
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) {
    body.append(name, value);
  }
  const context = {
    locals: { supabase, user },
    request: new Request("http://localhost/api/test", { method: "POST", body }),
    params,
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { Location: path } }),
  };
  // Cast: the handlers under test touch only the fields above.
  return context as unknown as APIContext;
}

/** Splits a redirect's Location into its path and query params. */
export function redirectTarget(response: Response): { path: string; params: URLSearchParams } {
  const location = response.headers.get("Location");
  if (location === null) {
    throw new Error(`expected a redirect with a Location header, got status ${response.status}`);
  }
  const url = new URL(location, "http://localhost");
  return { path: url.pathname, params: url.searchParams };
}
