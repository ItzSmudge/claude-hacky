import { describe, expect, it, vi } from "vitest";
import { searchRequestSchema } from "@/lib/api-schemas";
import { computeCredibility } from "@/lib/credibility";
import type { Paper } from "@/types/domain";
import type { OpenAlexSearchResult } from "./openalex";
import { matchesExcluded, parseExcludeTerms, searchPapers } from "./search";

const NOW = new Date("2026-10-15T12:00:00Z");

const paper = (id: string, over: Partial<Paper> = {}): Paper => ({
  id: `openalex-${id}`,
  source: "openalex",
  externalId: id,
  title: `Paper ${id}`,
  authors: [],
  topics: [],
  year: 2022,
  citationCount: 12,
  isPeerReviewed: true,
  ...over,
});

const result = (papers: Paper[], nextPage: number | null = 2): OpenAlexSearchResult => ({
  papers,
  total: 100,
  nextPage,
});

const request = (over: Record<string, unknown> = {}) =>
  searchRequestSchema.parse({ q: "social media teens", ...over });

describe("parseExcludeTerms", () => {
  it("reads repeated and comma-separated params, trimmed, deduped and capped", () => {
    const params = new URLSearchParams("exclude=Survey, adults&exclude=survey&exclude= &exclude=x");
    expect(parseExcludeTerms(params)).toEqual(["survey", "adults", "x"]);
    const many = new URLSearchParams(Array.from({ length: 30 }, (_, i) => ["exclude", `t${i}`]));
    expect(parseExcludeTerms(many)).toHaveLength(20);
    expect(parseExcludeTerms(new URLSearchParams(`exclude=${"a".repeat(200)}`))).toEqual([
      "a".repeat(80),
    ]);
  });

  it("returns undefined when there are no terms", () => {
    expect(parseExcludeTerms(new URLSearchParams("q=x"))).toBeUndefined();
  });
});

describe("matchesExcluded", () => {
  const p = paper("W1", {
    title: "Instagram use and sleep in adolescents",
    abstract: "A systematic review of 40 studies.",
    topics: ["Sleep and Wakefulness Research"],
  });

  it("matches whole words in the title, abstract or topics, ignoring case", () => {
    expect(matchesExcluded(p, ["instagram"])).toBe(true);
    expect(matchesExcluded(p, ["Systematic Review"])).toBe(true);
    expect(matchesExcluded(p, ["wakefulness"])).toBe(true);
  });

  it("does not match inside other words or when nothing matches", () => {
    expect(matchesExcluded(p, ["gram"])).toBe(false);
    expect(matchesExcluded(p, ["adult"])).toBe(false);
    expect(matchesExcluded(p, [])).toBe(false);
  });

  it("treats regex characters literally", () => {
    expect(matchesExcluded(paper("W2", { title: "C++ in schools" }), ["c++"])).toBe(true);
    expect(matchesExcluded(paper("W3", { title: "Schools" }), [".*"])).toBe(false);
  });
});

describe("searchPapers", () => {
  it("passes the query, years and paging through to OpenAlex", async () => {
    const search = vi.fn().mockResolvedValue(result([]));
    await searchPapers(request({ yearFrom: 2018, yearTo: 2024, page: 3, perPage: 10 }), {
      search,
      now: NOW,
    });
    expect(search).toHaveBeenCalledWith({
      q: "social media teens",
      yearFrom: 2018,
      yearTo: 2024,
      page: 3,
      perPage: 10,
    });
  });

  it("attaches the computed credibility to every paper and keeps nextPage", async () => {
    const p = paper("W1");
    const response = await searchPapers(request(), {
      search: async () => result([p], 4),
      now: NOW,
    });
    expect(response).toEqual({
      papers: [{ ...p, credibility: computeCredibility(p, { now: NOW }) }],
      nextPage: 4,
    });
  });

  it("drops papers matching exclude terms", async () => {
    const keep = paper("W1", { title: "Sleep and screens" });
    const drop = paper("W2", { title: "A survey of adults" });
    const response = await searchPapers(request({ exclude: ["adults"] }), {
      search: async () => result([keep, drop]),
      now: NOW,
    });
    expect(response.papers.map((x) => x.id)).toEqual(["openalex-W1"]);
  });

  it("caches the papers it returns, without credibility", async () => {
    const cache = vi.fn().mockResolvedValue(undefined);
    const keep = paper("W1");
    await searchPapers(request({ exclude: ["excluded"] }), {
      search: async () => result([keep, paper("W2", { title: "Excluded one" })]),
      cache,
      now: NOW,
    });
    expect(cache).toHaveBeenCalledWith([keep]);
  });

  it("still returns results when caching fails", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await searchPapers(request(), {
      search: async () => result([paper("W1")]),
      cache: async () => {
        throw new Error("db down");
      },
      now: NOW,
    });
    expect(response.papers).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("skips the cache call when nothing is left to cache", async () => {
    const cache = vi.fn();
    await searchPapers(request(), { search: async () => result([], null), cache, now: NOW });
    expect(cache).not.toHaveBeenCalled();
  });

  it("lets search errors propagate to the route", async () => {
    await expect(
      searchPapers(request(), { search: () => Promise.reject(new Error("upstream")) }),
    ).rejects.toThrow("upstream");
  });
});
