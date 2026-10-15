import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiOutputError, AiRefusalError } from "./errors";
import { generateJson, type AiClient } from "./json";
import { words } from "./schemas";

type Reply = Partial<Anthropic.Beta.BetaMessage> & { text?: string };

/** A fake client whose create() returns the given replies in order. */
function fakeClient(...replies: Reply[]) {
  const create = vi.fn(async () => {
    const r = replies.shift();
    if (!r) throw new Error("no more replies");
    const { text, ...rest } = r;
    return {
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      stop_reason: "end_turn",
      stop_details: null,
      content: text === undefined ? [] : [{ type: "text", text, citations: null }],
      usage: { input_tokens: 10, output_tokens: 5 },
      ...rest,
    } as unknown as Anthropic.Beta.BetaMessage;
  });
  const client = { beta: { messages: { create } } } as unknown as AiClient;
  return { client, create };
}

const schema = z.object({ title: z.string(), summary: words(5) });
const base = {
  schema,
  system: "You summarise papers.",
  messages: [{ role: "user" as const, content: "Paper text" }],
};
const requestOf = (create: ReturnType<typeof fakeClient>["create"], call = 0) =>
  (create.mock.calls[call] as unknown as [Record<string, unknown>, { signal?: AbortSignal }])[0];

describe("generateJson", () => {
  it("returns validated data on the first try", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"short one"}' });
    const result = await generateJson(client, "claude-haiku-5-5", base);
    expect(result).toMatchObject({
      data: { title: "T", summary: "short one" },
      repaired: false,
      model: "claude-haiku-5-5",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("sends a JSON output format, max_tokens and the messages", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(client, "claude-haiku-5-5", base);
    const req = requestOf(create);
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.max_tokens).toBe(16_000);
    expect(req.messages).toEqual(base.messages);
    expect((req.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect((req.output_config as { effort?: string }).effort).toBeUndefined();
    expect(req.system).toBe("You summarise papers.");
  });

  it("passes effort when set", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(client, "claude-haiku-5-5", { ...base, effort: "low" });
    expect((requestOf(create).output_config as { effort?: string }).effort).toBe("low");
  });

  it("caches the last system block when asked", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(client, "claude-haiku-5-5", { ...base, cacheSystem: true });
    expect(requestOf(create).system).toEqual([
      { type: "text", text: "You summarise papers.", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("enables server-side refusal fallback only for models that support it", async () => {
    const haiku = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(haiku.client, "claude-haiku-5-5", base);
    expect(requestOf(haiku.create).fallbacks).toBeUndefined();
    expect(requestOf(haiku.create).betas).toBeUndefined();

    const sonnet = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(sonnet.client, "claude-sonnet-5-5", base);
    expect(requestOf(sonnet.create).fallbacks).toBe("default");
    expect(requestOf(sonnet.create).betas).toEqual(["server-side-fallback-2026-07-01"]);
  });

  it("passes the abort signal through", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    const signal = new AbortController().signal;
    await generateJson(client, "claude-haiku-5-5", { ...base, signal });
    expect(
      (create.mock.calls[0] as unknown as [unknown, { signal?: AbortSignal }])[1]?.signal,
    ).toBe(signal);
  });

  it("reads only text blocks (e.g. after a fallback block)", async () => {
    const { client } = fakeClient({
      content: [
        { type: "fallback" },
        { type: "text", text: '{"title":"T",', citations: null },
        { type: "text", text: '"summary":"ok"}', citations: null },
      ] as unknown as Anthropic.Beta.BetaContentBlock[],
    });
    expect((await generateJson(client, "claude-sonnet-5-5", base)).data.title).toBe("T");
  });

  it("repairs invalid JSON once, showing the model its reply and the problem", async () => {
    const { client, create } = fakeClient(
      { text: "not json" },
      { text: '{"title":"T","summary":"fixed"}' },
    );
    const result = await generateJson(client, "claude-haiku-5-5", base);
    expect(result).toMatchObject({ data: { summary: "fixed" }, repaired: true });
    const repair = requestOf(create, 1).messages as Anthropic.Beta.BetaMessageParam[];
    expect(repair).toHaveLength(3);
    expect(repair[1]).toEqual({ role: "assistant", content: "not json" });
    expect(repair[2]?.role).toBe("user");
    expect(String(repair[2]?.content)).toMatch(/not valid JSON/i);
  });

  it("repairs a failed zod refinement (word limit) with the issue listed", async () => {
    const { client, create } = fakeClient(
      { text: '{"title":"T","summary":"one two three four five six"}' },
      { text: '{"title":"T","summary":"one two"}' },
    );
    const result = await generateJson(client, "claude-haiku-5-5", base);
    expect(result.repaired).toBe(true);
    const repair = requestOf(create, 1).messages as Anthropic.Beta.BetaMessageParam[];
    expect(String(repair[2]?.content)).toContain("summary: Use at most 5 words (got 6).");
  });

  it("sums usage across the repair", async () => {
    const { client } = fakeClient({ text: "nope" }, { text: '{"title":"T","summary":"ok"}' });
    const { usage } = await generateJson(client, "claude-haiku-5-5", base);
    expect(usage).toEqual({
      input_tokens: 20,
      output_tokens: 10,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
  });

  it("gives up after one failed repair with the issues attached", async () => {
    const { client, create } = fakeClient({ text: "nope" }, { text: '{"title":1}' });
    const error = await generateJson(client, "claude-haiku-5-5", base).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiOutputError);
    expect((error as AiOutputError).reason).toBe("invalid");
    expect((error as AiOutputError).issues.length).toBeGreaterThan(0);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("treats an empty reply as invalid and repairs it", async () => {
    const { client, create } = fakeClient({}, { text: '{"title":"T","summary":"ok"}' });
    expect((await generateJson(client, "claude-haiku-5-5", base)).repaired).toBe(true);
    const repair = requestOf(create, 1).messages as Anthropic.Beta.BetaMessageParam[];
    expect(repair[1]).toEqual({ role: "assistant", content: "(no output)" });
  });

  it("throws a refusal with its category, without repairing", async () => {
    const { client, create } = fakeClient({
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "x" },
    } as Reply);
    const error = await generateJson(client, "claude-haiku-5-5", base).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiRefusalError);
    expect((error as AiRefusalError).category).toBe("cyber");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("throws truncated output on max_tokens, without repairing", async () => {
    const { client, create } = fakeClient({ stop_reason: "max_tokens", text: '{"title":"T"' });
    const error = await generateJson(client, "claude-haiku-5-5", base).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiOutputError);
    expect((error as AiOutputError).reason).toBe("truncated");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("throws truncated output when the context window is exceeded", async () => {
    const { client, create } = fakeClient({
      stop_reason: "model_context_window_exceeded",
    } as Reply);
    const error = await generateJson(client, "claude-haiku-5-5", base).catch((e: unknown) => e);
    expect((error as AiOutputError).reason).toBe("truncated");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("passes timeout and maxRetries as request options", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(client, "claude-haiku-5-5", { ...base, timeout: 1_000, maxRetries: 1 });
    expect(create.mock.calls[0] as unknown as [unknown, object]).toEqual([
      expect.anything(),
      expect.objectContaining({ timeout: 1_000, maxRetries: 1 }),
    ]);
  });

  it("tells the model the word limit in the JSON schema", async () => {
    const { client, create } = fakeClient({ text: '{"title":"T","summary":"ok"}' });
    await generateJson(client, "claude-haiku-5-5", base);
    const format = (requestOf(create).output_config as { format: { schema: unknown } }).format;
    expect(JSON.stringify(format.schema)).toContain("At most 5 words.");
  });

  it("applies the same checks to the repair reply", async () => {
    const { client } = fakeClient({ text: "nope" }, { stop_reason: "refusal" } as Reply);
    await expect(generateJson(client, "claude-haiku-5-5", base)).rejects.toBeInstanceOf(
      AiRefusalError,
    );
  });
});
