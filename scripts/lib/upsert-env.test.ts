import { describe, expect, it } from "vitest";
import { upsertEnv } from "./upsert-env.mjs";

describe("upsertEnv", () => {
  it("replaces existing keys in place and drops their inline comments", () => {
    const input = "A=1\nNEXT_PUBLIC_SUPABASE_URL=http://x   # prod: …\nB=2\n";
    expect(upsertEnv(input, { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54421" })).toBe(
      "A=1\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421\nB=2\n",
    );
  });

  it("appends missing keys and keeps other lines untouched", () => {
    expect(upsertEnv("# comment\nANTHROPIC_API_KEY=sk\n", { NEW: "v" })).toBe(
      "# comment\nANTHROPIC_API_KEY=sk\nNEW=v\n",
    );
  });

  it("does not touch keys that merely share a prefix", () => {
    expect(upsertEnv("KEY_LONG=a\nKEY=b\n", { KEY: "c" })).toBe("KEY_LONG=a\nKEY=c\n");
  });
});
