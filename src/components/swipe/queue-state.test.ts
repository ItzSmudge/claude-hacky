import { describe, expect, it } from "vitest";
import { idsToAnalyse, isRelevant, MIN_RELEVANCE, shouldAutoPage } from "./queue-state";

const ids = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
const none = new Set<string>();

describe("idsToAnalyse", () => {
  it("asks for the top card plus three ahead", () => {
    expect(
      idsToAnalyse({ candidates: ids, analysed: {}, inflight: none, failed: none, decided: none }),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("skips analysed, in-flight and decided papers", () => {
    expect(
      idsToAnalyse({
        candidates: ids,
        analysed: { b: 1 },
        inflight: new Set(["c"]),
        failed: none,
        decided: new Set(["a"]),
      }),
    ).toEqual(["d", "e"]);
  });
  it("slides the window past failed papers", () => {
    expect(
      idsToAnalyse({
        candidates: ids,
        analysed: {},
        inflight: none,
        failed: new Set(["a"]),
        decided: none,
      }),
    ).toEqual(["b", "c", "d", "e"]);
  });
});

describe("shouldAutoPage", () => {
  const base = {
    undecided: 0,
    nextPage: 1,
    searchError: false,
    analyseUnavailable: false,
    barrenPages: 0,
  };

  it("fetches when the deck is running low", () => {
    expect(shouldAutoPage(base)).toBe(true);
  });
  it("does not fetch when there are plenty of papers waiting", () => {
    expect(shouldAutoPage({ ...base, undecided: 6 })).toBe(false);
  });
  it("stops after two pages in a row with nothing analysed", () => {
    expect(shouldAutoPage({ ...base, barrenPages: 1 })).toBe(true);
    expect(shouldAutoPage({ ...base, barrenPages: 2 })).toBe(false);
  });
  it("never auto-pages once the analyse endpoint is known to be unavailable", () => {
    expect(shouldAutoPage({ ...base, analyseUnavailable: true })).toBe(false);
  });
  it("does not retry a failed search by itself or page past the last page", () => {
    expect(shouldAutoPage({ ...base, searchError: true })).toBe(false);
    expect(shouldAutoPage({ ...base, nextPage: null })).toBe(false);
  });
});

describe("isRelevant", () => {
  it("keeps cards scored at or above MIN_RELEVANCE and drops the rest", () => {
    expect(isRelevant({ relevance: MIN_RELEVANCE })).toBe(true);
    expect(isRelevant({ relevance: 90 })).toBe(true);
    expect(isRelevant({ relevance: MIN_RELEVANCE - 1 })).toBe(false);
  });
});
