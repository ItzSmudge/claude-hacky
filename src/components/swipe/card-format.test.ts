import { describe, expect, it } from "vitest";
import type { Paper } from "@/types/domain";
import { clampRelevance, formatAuthors, formatMeta, resolveStances } from "./card-format";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "openalex-W1",
  source: "openalex",
  externalId: "W1",
  title: "A paper",
  authors: [],
  topics: [],
  ...over,
});

describe("formatAuthors", () => {
  it("uses the surname of a single author", () => {
    expect(formatAuthors([{ name: "Maartje Boer" }])).toBe("Boer");
  });

  it("joins two surnames", () => {
    expect(formatAuthors([{ name: "Maartje Boer" }, { name: "Gonneke W. J. M. Stevens" }])).toBe(
      "Boer and Stevens",
    );
  });

  it("shortens three or more to et al.", () => {
    expect(formatAuthors([{ name: "A Boer" }, { name: "B Stevens" }, { name: "C Looze" }])).toBe(
      "Boer et al.",
    );
  });

  it("ignores blank names and returns undefined when none are left", () => {
    expect(formatAuthors([{ name: "  " }])).toBeUndefined();
    expect(formatAuthors([])).toBeUndefined();
  });
});

describe("formatMeta", () => {
  it("returns venue, year and author", () => {
    expect(
      formatMeta(
        paper({ venue: "Computers in Human Behavior", year: 2020, authors: [{ name: "M Boer" }] }),
      ),
    ).toEqual({ venue: "Computers in Human Behavior", year: "2020", author: "Boer" });
  });

  it("falls back to 'not stated' for missing fields", () => {
    expect(formatMeta(paper({ venue: " " }))).toEqual({
      venue: "Venue not stated",
      year: "Year not stated",
      author: "Authors not stated",
    });
  });
});

describe("resolveStances", () => {
  const claims = [
    { id: "c1", text: "Claim one." },
    { id: "c2", text: "Claim two." },
  ];

  it("labels stances by claim position and attaches the claim text", () => {
    expect(
      resolveStances([{ claimId: "c2", stance: "supports", note: "Backs it." }], claims),
    ).toEqual([
      {
        claimId: "c2",
        stance: "supports",
        note: "Backs it.",
        label: "Claim 2",
        claimText: "Claim two.",
      },
    ]);
  });

  it("drops stances whose claim id is unknown", () => {
    expect(resolveStances([{ claimId: "c9", stance: "neutral", note: "" }], claims)).toEqual([]);
  });
});

describe("clampRelevance", () => {
  it.each([
    [42, 42],
    [42.6, 43],
    [-5, 0],
    [130, 100],
    [Number.NaN, 0],
  ])("%s → %s", (input, expected) => {
    expect(clampRelevance(input)).toBe(expected);
  });
});
