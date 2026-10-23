// Runner probe: proves an integration test can sign up a user against local Supabase and read through RLS.
import { describe, expect, it } from "vitest";

import { signUpUser } from "../helpers/supabase";

describe("integration runner wiring", () => {
  it("signs up a user who sees the 8 starter categories", async () => {
    const { client } = await signUpUser("probe");
    const { data, error } = await client.from("categories").select("name, user_id");
    expect(error).toBeNull();
    const starters = (data ?? []).filter((category) => category.user_id === null);
    expect(starters).toHaveLength(8);
  });
});
