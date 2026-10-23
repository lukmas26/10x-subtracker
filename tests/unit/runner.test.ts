// Runner probe: proves the `@/` alias and Astro's virtual modules resolve under Vitest.
import { describe, expect, it } from "vitest";

import { createClient } from "@/lib/supabase";
import { CURRENCIES } from "@/types";

describe("runner wiring", () => {
  it("resolves the @/ alias", () => {
    expect(CURRENCIES).toEqual(["PLN", "EUR", "USD"]);
  });

  it("loads a module that imports astro:env/server", () => {
    expect(typeof createClient).toBe("function");
  });
});
