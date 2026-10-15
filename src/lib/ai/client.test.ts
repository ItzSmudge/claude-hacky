import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  requireServerVar: () => {
    throw new Error("❌ ANTHROPIC_API_KEY is not set.");
  },
  serverEnv: () => ({
    ANTHROPIC_MODEL_FAST: "claude-haiku-5-5",
    ANTHROPIC_MODEL_SMART: "claude-sonnet-5-5",
  }),
}));

const { askJson, modelFor } = await import("./client");
const { AiConfigError } = await import("./errors");

describe("client", () => {
  it("maps tiers to the env models", () => {
    expect(modelFor("fast")).toBe("claude-haiku-5-5");
    expect(modelFor("smart")).toBe("claude-sonnet-5-5");
  });

  it("throws AiConfigError when the API key is missing", async () => {
    await expect(
      askJson({ tier: "fast", schema: z.object({}), system: "s", messages: [] }),
    ).rejects.toBeInstanceOf(AiConfigError);
  });
});
