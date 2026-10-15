import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({
  ANTHROPIC_API_KEY: undefined as string | undefined,
  ANTHROPIC_MODEL_FAST: "claude-haiku-5-5",
  ANTHROPIC_MODEL_SMART: "claude-sonnet-5-5",
}));
vi.mock("@/lib/env", () => ({ serverEnv: () => env }));
const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));

const { askJson, modelFor } = await import("./client");
const { AiConfigError } = await import("./errors");

const request = { schema: z.object({}), system: "s", messages: [] };

describe("client", () => {
  it("maps tiers to the env models", () => {
    expect(modelFor("fast")).toBe("claude-haiku-5-5");
    expect(modelFor("smart")).toBe("claude-sonnet-5-5");
  });

  it("throws AiConfigError when the API key is missing", async () => {
    await expect(askJson({ tier: "fast", ...request })).rejects.toBeInstanceOf(AiConfigError);
  });

  it("applies per-tier timeout and retries, overridable per call", async () => {
    env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "{}" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    await askJson({ tier: "fast", ...request });
    expect(create.mock.calls[0]?.[1]).toMatchObject({ timeout: 60_000, maxRetries: 2 });
    await askJson({ tier: "smart", ...request, timeout: 5_000 });
    expect(create.mock.calls[1]?.[1]).toMatchObject({ timeout: 5_000, maxRetries: 2 });
  });
});
