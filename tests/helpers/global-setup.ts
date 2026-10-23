// Integration global setup: fail the whole run before any test signs up users against a non-local Supabase.
import { assertLocalSupabase } from "./supabase";

export default function setup(): void {
  assertLocalSupabase();
}
