import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fixturePapers } from "@/fixtures";
import {
  briefContextOutputSchema,
  countWords,
  normaliseNotStated,
  NOT_STATED,
  notStated,
  paperAnalysisOutputSchema,
  words,
} from "./schemas";

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

describe("normaliseNotStated", () => {
  it.each(["not stated", "Not stated.", "N/A", "None stated", "unknown", "  not stated  "])(
    "turns %j into the exact marker",
    (text) => expect(normaliseNotStated(text)).toBe(NOT_STATED),
  );

  it("leaves real text alone", () => {
    expect(normaliseNotStated("Survey of 500 teens.")).toBe("Survey of 500 teens.");
  });
});

describe("briefContextOutputSchema", () => {
  const valid = {
    topic: "Social media and adolescent wellbeing",
    summary:
      "A 2,000-word essay arguing whether heavy social media use harms teenage mental health.",
    claims: ["Heavy social media use worsens adolescent sleep."],
    themes: ["sleep", "anxiety"],
    constraints: ["Sources from 2015 onwards"],
  };

  it("accepts a valid context", () => {
    expect(briefContextOutputSchema.parse(valid)).toEqual(valid);
  });

  it("accepts empty lists and a not-stated summary", () => {
    const empty = { ...valid, summary: NOT_STATED, claims: [], themes: [], constraints: [] };
    expect(briefContextOutputSchema.safeParse(empty).success).toBe(true);
  });

  it("rejects more than 6 claims", () => {
    const claims = Array.from({ length: 7 }, (_, i) => `Claim number ${i}.`);
    expect(briefContextOutputSchema.safeParse({ ...valid, claims }).success).toBe(false);
  });

  it("rejects a claim over 25 words", () => {
    const claims = ["word ".repeat(26).trim()];
    expect(briefContextOutputSchema.safeParse({ ...valid, claims }).success).toBe(false);
  });

  it.each([
    ["claims", ["See https://example.org for details."]],
    ["constraints", ["Must cite 10.1000/xyz123"]],
    ["themes", ["www.example.org"]],
  ])("rejects links and DOIs in %s", (field, value) => {
    expect(briefContextOutputSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it("rejects an empty topic", () => {
    expect(briefContextOutputSchema.safeParse({ ...valid, topic: "  " }).success).toBe(false);
  });

  it("tells the model the limits in the JSON schema", () => {
    const json = JSON.stringify(betaZodOutputFormat(briefContextOutputSchema).schema);
    expect(json).toMatch(/at most 25 words/i);
    expect(json).toMatch(/up to 6 claims/i);
    expect(json).toContain(String.raw`exactly \"not stated\"`);
  });
});
