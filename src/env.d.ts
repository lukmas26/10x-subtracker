declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    /** The request's Supabase client, created once in middleware; null when Supabase is not configured. */
    supabase: import("@supabase/supabase-js").SupabaseClient<import("@/db/database.types").Database> | null;
  }
}
