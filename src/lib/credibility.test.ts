import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { Paper } from "@/types/domain";
import { computeCredibility, venueTypeOf } from "./credibility";

const NOW = new Date("2026-10-15T12:00:00Z");

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "openalex-W1",
  source: "openalex",
  externalId: "W1",
  title: "A paper",
  authors: [],
  topics: [],
  ...over,
});

const score = (over: Partial<Paper>) => computeCredibility(paper(over), { now: NOW }).score;

describe("computeCredibility", () => {
  it("gives a well-cited recent peer-reviewed journal article a high score", () => {
    const result = computeCredibility(
      paper({
        citationCount: 330,
        isPeerReviewed: true,
        venue: "Computers in Human Behavior",
        year: 2020,
      }),
      { now: NOW },
    );
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.inputs).toEqual({
      citationCount: 330,
      peerReviewed: true,
      venueType: "journal",
      year: 2020,
    });
  });

  it("gives an uncited preprint a low score", () => {
    expect(
      score({
        citationCount: 0,
        isPeerReviewed: false,
        venue: "arXiv (Cornell University)",
        year: 2026,
      }),
    ).toBeLessThan(40);
  });

  it("omits missing inputs instead of guessing them", () => {
    const result = computeCredibility(paper(), { now: NOW });
    expect(result.inputs).toEqual({});
    // unknown peer review 10 + unknown venue 5 + unknown recency 5
    expect(result.score).toBe(20);
  });

  it("stays an integer between 0 and 100", () => {
    for (const over of [
      {},
      { citationCount: 10_000_000, isPeerReviewed: true, venue: "Nature", year: 2026 },
      { citationCount: 0, isPeerReviewed: false, year: 1900 },
    ]) {
      const s = score(over);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
    expect(
      score({ citationCount: 10_000_000, isPeerReviewed: true, venue: "Nature", year: 2026 }),
    ).toBe(100);
  });

  it("is deterministic for the same paper and date", () => {
    const p = paper({ citationCount: 42, isPeerReviewed: true, year: 2019 });
    expect(computeCredibility(p, { now: NOW })).toEqual(computeCredibility(p, { now: NOW }));
  });

  describe("citations", () => {
    it("rise with citations but adjust for age", () => {
      expect(score({ citationCount: 100, year: 2024 })).toBeGreaterThan(
        score({ citationCount: 10, year: 2024 }),
      );
      // same count, older paper → fewer citations per year → lower citation points
      const young = score({ citationCount: 100, year: 2024 });
      const old = score({ citationCount: 100, year: 2004 });
      expect(young).toBeGreaterThan(old);
    });

    it("treats negative or non-finite counts as missing", () => {
      expect(computeCredibility(paper({ citationCount: -5 }), { now: NOW }).inputs).toEqual({});
      expect(score({ citationCount: Number.NaN })).toBe(score({}));
    });

    it("counts a future year as brand new", () => {
      expect(score({ citationCount: 10, year: 2027 })).toBe(
        score({ citationCount: 10, year: 2026 }),
      );
    });
  });

  it("scores peer review true > unknown > false", () => {
    expect(score({ isPeerReviewed: true })).toBeGreaterThan(score({}));
    expect(score({})).toBeGreaterThan(score({ isPeerReviewed: false }));
  });

  it("scores recency in bands", () => {
    const at = (year: number) => score({ year });
    expect(at(2022)).toBeGreaterThan(at(2018));
    expect(at(2018)).toBeGreaterThan(at(2010));
    expect(at(2010)).toBeGreaterThan(at(1990));
  });
});

describe("venueTypeOf", () => {
  it("recognises preprint servers, proceedings and books by name", () => {
    expect(venueTypeOf(paper({ venue: "bioRxiv (Cold Spring Harbor Laboratory)" }))).toBe(
      "preprint",
    );
    expect(venueTypeOf(paper({ venue: "SSRN Electronic Journal", isPeerReviewed: true }))).toBe(
      "preprint",
    );
    expect(
      venueTypeOf(paper({ venue: "Proceedings of the ACM CHI Conference", isPeerReviewed: true })),
    ).toBe("conference");
    expect(venueTypeOf(paper({ venue: "Handbook of Adolescent Psychology" }))).toBe("book");
    expect(
      venueTypeOf(
        paper({ venue: "Annual Meeting of the Association for Computational Linguistics" }),
      ),
    ).toBe("conference");
    expect(venueTypeOf(paper({ venue: "Elsevier eBooks" }))).toBe("book");
  });

  it("keeps journals named 'Proceedings of …' as journals", () => {
    for (const venue of [
      "Proceedings of the National Academy of Sciences",
      "Proceedings of the Royal Society B Biological Sciences",
      "Proceedings of the IEEE",
    ]) {
      expect(venueTypeOf(paper({ venue, isPeerReviewed: true })), venue).toBe("journal");
    }
    expect(
      venueTypeOf(paper({ venue: "Proceedings of the IEEE International Conference on Robotics" })),
    ).toBe("conference");
  });

  it("treats other peer-reviewed venues as journals and leaves the rest unknown", () => {
    expect(venueTypeOf(paper({ venue: "BMC Public Health", isPeerReviewed: true }))).toBe(
      "journal",
    );
    expect(venueTypeOf(paper({ venue: "Figshare", isPeerReviewed: false }))).toBeUndefined();
    expect(venueTypeOf(paper())).toBeUndefined();
  });
});

describe("fixtures", () => {
  const byId = (id: string) => fixturePapers.find((e) => e.paper.id === id)!;

  it("stores credibility computed by this function (regenerate after changing the formula)", () => {
    for (const { paper: p, credibility } of fixturePapers) {
      expect(credibility, p.id).toEqual(computeCredibility(p, { now: NOW }));
    }
  });

  it("ranks a heavily cited review above an uncited conference abstract", () => {
    const review = byId("openalex-W3195706482"); // Current Opinion in Psychology, 746 citations
    const abstract = byId("openalex-W4387900607"); // European Journal of Public Health supplement, 0 citations
    expect(review.credibility.score).toBeGreaterThan(abstract.credibility.score);
  });
});
