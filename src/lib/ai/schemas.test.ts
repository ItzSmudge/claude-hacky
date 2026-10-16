import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fixturePapers } from "@/fixtures";
import { countWords, NOT_STATED, notStated, paperAnalysisOutputSchema, words } from "./schemas";

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

  it("allows links unless noLinks is set", () => {
    expect(words(10).safeParse("Data from www.ons.gov.uk").success).toBe(true);
    expect(words(10, { noLinks: true }).safeParse("Data from www.ons.gov.uk").success).toBe(false);
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

describe("paperAnalysisOutputSchema", () => {
  const valid = {
    overview: "Three-wave study of teens linking problematic use to later distress.",
    whyItMatters: "Separates problematic use from heavy use.",
    relevance: 90,
    relevanceReason: "Directly tests use vs problems",
    stances: [
      { claimId: "c1", stance: "challenges", note: "Intensity alone did not predict harm" },
    ],
    methodology: "Three-wave longitudinal panel.",
    limitations: NOT_STATED,
    useAs: "evidence",
  };

  it("accepts every fixture analysis (without ids)", () => {
    for (const { analysis } of fixturePapers) {
      const { paperId: _p, projectId: _q, ...output } = analysis;
      expect(paperAnalysisOutputSchema.safeParse(output).error?.issues ?? []).toEqual([]);
    }
  });

  it("has no bibliographic or id fields", () => {
    const keys = Object.keys(paperAnalysisOutputSchema.shape);
    for (const banned of [
      "paperId",
      "projectId",
      "title",
      "authors",
      "year",
      "venue",
      "doi",
      "url",
    ])
      expect(keys).not.toContain(banned);
  });

  it.each([
    ["overview", "word ".repeat(36)],
    ["whyItMatters", "word ".repeat(21)],
    ["relevanceReason", "word ".repeat(9)],
    ["methodology", "word ".repeat(16)],
    ["limitations", "word ".repeat(16)],
  ])("enforces the %s word limit", (field, text) => {
    expect(paperAnalysisOutputSchema.safeParse({ ...valid, [field]: text }).success).toBe(false);
  });

  it.each([
    ["a URL", "See https://example.org/paper for details."],
    ["a www link", "Read more at www.example.org today."],
    ["a DOI", "Replicates doi 10.1016/j.chb.2020.106645 closely."],
  ])("rejects %s in text fields", (_label, text) => {
    const result = paperAnalysisOutputSchema.safeParse({ ...valid, overview: text });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/link|DOI/i);
  });

  it("rejects a URL in a stance note", () => {
    const stances = [{ claimId: "c1", stance: "supports", note: "see http://x.org" }];
    expect(paperAnalysisOutputSchema.safeParse({ ...valid, stances }).success).toBe(false);
  });

  it("bounds relevance to an integer 0–100", () => {
    for (const relevance of [-1, 101, 50.5])
      expect(paperAnalysisOutputSchema.safeParse({ ...valid, relevance }).success).toBe(false);
  });

  it("tells the model the limits in the JSON schema", () => {
    const json = JSON.stringify(betaZodOutputFormat(paperAnalysisOutputSchema).schema);
    expect(json).toMatch(/at most 35 words/i);
    expect(json).toMatch(/one entry per claim id/i);
    expect(json).toContain(String.raw`exactly \"not stated\"`);
  });
});
