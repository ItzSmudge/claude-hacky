import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { countWords, NOT_STATED, notStated, words } from "./schemas";

describe("countWords", () => {
  it.each([
    ["", 0],
    ["   ", 0],
    ["one", 1],
    ["two words", 2],
    [" spaced   out\nlines\tand tabs ", 5],
    ["well-being counts once", 3],
  ])("%j → %i", (text, n) => {
    expect(countWords(text)).toBe(n);
  });
});

describe("words", () => {
  it("accepts text within the limit and trims it", () => {
    expect(words(3).parse("  one two three ")).toBe("one two three");
  });

  it("rejects text over the limit with a readable message", () => {
    const result = words(2).safeParse("one two three");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Use at most 2 words (got 3).");
  });

  it("rejects empty text", () => {
    expect(words(5).safeParse("   ").success).toBe(false);
  });
});

describe("notStated", () => {
  it("accepts the not-stated marker", () => {
    expect(notStated(10).parse(NOT_STATED)).toBe("not stated");
  });

  it("enforces the word limit", () => {
    expect(notStated(2).safeParse("far too many words here").success).toBe(false);
  });

  it("tells the model what to write when the source is silent", () => {
    expect(notStated(10).description).toContain('"not stated"');
  });
});

describe("structured-output compatibility", () => {
  it("builds an output format from schemas using these helpers", () => {
    const schema = z.object({ summary: words(30), limits: notStated(20) });
    expect(() => betaZodOutputFormat(schema)).not.toThrow();
  });
});
