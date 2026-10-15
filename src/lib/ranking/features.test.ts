import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { Credibility, Paper } from "@/types/domain";
import { extractFeatures, type FeatureKind } from "./features";

const NOW = new Date("2026-10-15T12:00:00Z");
const ORDER: FeatureKind[] = ["topic", "keyword", "study", "year", "venue", "cited"];

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "openalex-W1",
  source: "openalex",
  externalId: "W1",
  title: "",
  authors: [],
  topics: [],
  ...over,
});

const ids = (p: Partial<Paper>, credibility?: Credibility) =>
  extractFeatures(paper(p), { now: NOW, credibility }).map((f) => f.id);

const ofKind = (p: Partial<Paper>, kind: FeatureKind, credibility?: Credibility) =>
  extractFeatures(paper(p), { now: NOW, credibility })
    .filter((f) => f.kind === kind)
    .map((f) => f.id);

describe("topics", () => {
  it("slugs topics and keeps their label", () => {
    const [f] = extractFeatures(paper({ topics: ["Impact of Technology on Adolescents"] }), {
      now: NOW,
    });
    expect(f).toEqual({
      id: "topic:impact-of-technology-on-adolescents",
      kind: "topic",
      label: "Impact of Technology on Adolescents",
    });
  });

  it("dedupes case-insensitively, skips blanks and punctuation-only topics, caps at 5", () => {
    expect(
      ofKind({ topics: ["A b", "a B", " ", "++", "a b", "A B", "c", "d", "e", "f", "g"] }, "topic"),
    ).toEqual(["topic:a-b", "topic:c", "topic:d", "topic:e", "topic:f"]);
  });
});

describe("keywords", () => {
  it("keeps content words of 4+ letters in title order, minus stopwords", () => {
    expect(
      ofKind({ title: "The Impact of Social Media on Adolescent Sleep: A Study" }, "keyword"),
    ).toEqual(["keyword:social", "keyword:media", "keyword:adolescent", "keyword:sleep"]);
  });

  it("folds simple plurals and dedupes", () => {
    expect(ofKind({ title: "Adolescents, adolescent studies and Theories" }, "keyword")).toEqual([
      "keyword:adolescent",
      "keyword:theory",
    ]);
  });

  it("keeps words whose -s or -ies is not a plural", () => {
    expect(
      ofKind({ title: "Bias in news series about species, physics and diabetes" }, "keyword"),
    ).toEqual([
      "keyword:bias",
      "keyword:news",
      "keyword:series",
      "keyword:species",
      "keyword:physics",
      "keyword:diabetes",
    ]);
  });

  it("applies the length minimum and stopwords after folding", () => {
    expect(ofKind({ title: "Does sleep help? Uses and analyses of dreams" }, "keyword")).toEqual([
      "keyword:sleep",
      "keyword:help",
      "keyword:dream",
    ]);
  });

  it("leaves study-type words to the study feature", () => {
    expect(
      ofKind({ title: "Sleep: a longitudinal cohort survey and meta-analysis" }, "keyword"),
    ).toEqual(["keyword:sleep"]);
  });

  it("treats composed and decomposed accents the same", () => {
    const nfc = ofKind({ title: "Bien-être numérique" }, "keyword");
    expect(ofKind({ title: "Bien-être numérique".normalize("NFD") }, "keyword")).toEqual(nfc);
  });

  it("does not fold -ss, -us or -is endings", () => {
    expect(ofKind({ title: "Stress status analysis" }, "keyword")).toEqual([
      "keyword:stress",
      "keyword:status",
    ]);
  });

  it("keeps non-ASCII letters and hyphenated compounds", () => {
    expect(ofKind({ title: "Bien-être numérique and well-being" }, "keyword")).toEqual([
      "keyword:bien-être",
      "keyword:numérique",
      "keyword:well-being",
    ]);
  });

  it("caps at 8", () => {
    const title = "alpha bravo charlie delta echoes foxtrot golfing hotel indigo juliet";
    expect(ofKind({ title }, "keyword")).toHaveLength(8);
  });
});

describe("study type", () => {
  it.each([
    ["A systematic review and meta-analysis", ["study:review"]],
    ["An umbrella review of the evidence", ["study:review"]],
    ["Social media and teens: a review", ["study:review"]],
    ["A three-wave longitudinal cohort study", ["study:longitudinal"]],
    ["Cross-lagged panel models of use", ["study:longitudinal"]],
    ["A randomised controlled trial", ["study:trial"]],
    ["Problematic use interventions for mental health", ["study:trial"]],
    ["A cross-sectional survey of 272 teens", ["study:cross-sectional"]],
    ["Teens' views: a qualitative interview study", ["study:qualitative"]],
    ["Longitudinal follow-up of an RCT", ["study:longitudinal", "study:trial"]],
    ["A meta analysis of sleep", ["study:review"]],
    ["Two cohorts followed up: follow up at 5 years", ["study:longitudinal"]],
    ["Three controlled trials", ["study:trial"]],
    ["A prospective cohort of teens", ["study:longitudinal"]],
    ["Panel data on screen time", ["study:longitudinal"]],
    ["Prospective teachers' beliefs about an expert panel", []],
    ["A survey of deep learning methods", ["study:review"]],
    ["A survey on the literature of sleep", ["study:review"]],
    ["Social media and adolescent mental health", []],
  ])("%s", (title, expected) => {
    expect(ofKind({ title }, "study")).toEqual(expected);
  });

  it("labels study types for UI copy", () => {
    const f = extractFeatures(paper({ title: "A scoping review" }), { now: NOW });
    expect(f.find((x) => x.kind === "study")?.label).toBe("Reviews");
  });
});

describe("year bucket", () => {
  it.each([
    [2027, "year:recent"],
    [2026, "year:recent"],
    [2024, "year:recent"],
    [2023, "year:3-5-years"],
    [2021, "year:3-5-years"],
    [2020, "year:6-10-years"],
    [2016, "year:6-10-years"],
    [2015, "year:older"],
  ])("%i → %s", (year, expected) => {
    expect(ofKind({ year }, "year")).toEqual([expected]);
  });

  it.each([undefined, 0, Number.NaN, 2028])("ignores %s", (year) => {
    expect(ofKind({ year }, "year")).toEqual([]);
  });
});

describe("venue type", () => {
  const cred = (venueType: unknown): Credibility => ({
    score: 50,
    inputs: { venueType } as Credibility["inputs"],
  });

  it("prefers credibility.inputs.venueType", () => {
    expect(ofKind({ venue: "arXiv" }, "venue", cred("journal"))).toEqual(["venue:journal"]);
  });

  it.each([
    ["arXiv (Cornell University)", "venue:preprint"],
    ["medRxiv", "venue:preprint"],
    ["Proceedings of CHI", "venue:conference"],
    ["International Conference on Learning", "venue:conference"],
    ["Handbook of Adolescent Psychology", "venue:book"],
  ])("guesses %s → %s", (venue, expected) => {
    expect(ofKind({ venue }, "venue")).toEqual([expected]);
  });

  it("ignores unknown venue types and names", () => {
    expect(ofKind({ venue: "Retos" }, "venue", cred("magazine"))).toEqual([]);
    expect(ofKind({}, "venue")).toEqual([]);
  });
});

describe("citation band", () => {
  it.each([
    [0, "cited:rarely"],
    [9, "cited:rarely"],
    [10, "cited:some"],
    [99, "cited:some"],
    [100, "cited:well"],
    [999, "cited:well"],
    [1000, "cited:highly"],
  ])("%i → %s", (citationCount, expected) => {
    expect(ofKind({ citationCount }, "cited")).toEqual([expected]);
  });

  it.each([undefined, -1, Number.NaN])("ignores %s", (citationCount) => {
    expect(ofKind({ citationCount }, "cited")).toEqual([]);
  });
});

describe("extractFeatures", () => {
  it("returns nothing for an empty paper", () => {
    expect(ids({})).toEqual([]);
  });

  it("orders by kind: topic, keyword, study, year, venue, cited", () => {
    const kinds = extractFeatures(
      paper({
        title: "Sleep: a longitudinal study",
        topics: ["Sleep"],
        year: 2020,
        venue: "medRxiv",
        citationCount: 12,
      }),
      { now: NOW },
    ).map((f) => f.kind);
    expect([...new Set(kinds)]).toEqual(["topic", "keyword", "study", "year", "venue", "cited"]);
    expect(kinds).toEqual([...kinds].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)));
  });

  it("is deterministic and has unique ids", () => {
    const p = { title: "Review of reviews: a review", topics: ["X", "x"], year: 2020 };
    expect(ids(p)).toEqual(ids(p));
    expect(new Set(ids(p)).size).toBe(ids(p).length);
  });

  it("gives every fixture paper a non-topic feature, with varied study types", () => {
    const all = fixturePapers.map(({ paper: p, credibility }) =>
      extractFeatures(p, { credibility, now: NOW }),
    );
    for (const features of all) {
      expect(features.some((f) => f.kind !== "topic")).toBe(true);
    }
    const studies = new Set(
      all
        .flat()
        .filter((f) => f.kind === "study")
        .map((f) => f.id),
    );
    expect(studies.size).toBeGreaterThanOrEqual(2);
  });
});
