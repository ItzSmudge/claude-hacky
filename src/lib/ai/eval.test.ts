import { describe, expect, it } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import type { Paper, PaperAnalysis } from "@/types/domain";
import { checkAnalysis, formatEvalReport, type EvalRow } from "./eval";

const context = fixtureProject.context;
const paper = fixturePapers[0]!.paper; // Boer et al. 2020, abstract mentions "2109"
const others = fixturePapers.slice(1).map((e) => e.paper);

const good = (over: Partial<PaperAnalysis> = {}): PaperAnalysis => ({
  paperId: paper.id,
  projectId: fixtureProject.id,
  overview:
    "A three-wave longitudinal study of 2109 adolescents linked problematic social media use to lower mental health.",
  whyItMatters:
    "Tests whether problematic use, not intensity, predicts worse adolescent mental health.",
  relevance: 85,
  relevanceReason: "Longitudinal data on the main claim",
  stances: context.claims.map((c) => ({
    claimId: c.id,
    stance: "neutral" as const,
    note: "Mixed findings across waves",
  })),
  methodology: "Three-wave longitudinal survey of secondary school adolescents",
  limitations: "not stated",
  useAs: "evidence",
  ...over,
});

const check = (analysis: PaperAnalysis, p: Paper = paper, repaired = false) =>
  checkAnalysis(p, analysis, { others, context, repaired });

describe("checkAnalysis", () => {
  it("passes a grounded analysis", () => {
    expect(check(good())).toEqual({ failures: [], warnings: [] });
  });

  it.each([
    ["a link", "See https://example.org for more."],
    ["a DOI", "Reported in 10.1016/j.chb.2020.106645 already."],
  ])("fails on %s", (_label, text) => {
    expect(check(good({ whyItMatters: text })).failures).toHaveLength(1);
  });

  it.each([
    "Boer finds an effect.",
    "Boer's study finds an effect.",
    "BOER finds an effect.",
    "As de Looze shows.",
  ])("fails on an author surname: %s", (text) => {
    expect(check(good({ whyItMatters: text })).failures.join(" ")).toMatch(/author/i);
  });

  it("fails on a 6-word run of another fixture paper's title, ignoring punctuation", () => {
    // "Social Media Use and Adolescent Mental Health: Findings From the UK Millennium Cohort Study"
    const text = "Echoes findings from the UK Millennium Cohort Study closely.";
    expect(check(good({ overview: text })).failures.join(" ")).toMatch(/title/i);
  });

  it("fails on a 6-word run of its own title without the commas", () => {
    const text = "It covers social media use intensity social media use problems.";
    expect(check(good({ overview: text })).failures.join(" ")).toMatch(/title/i);
  });

  it("allows a title run that the paper's abstract or the brief also uses (live false alarm)", () => {
    // Another fixture title starts "Social Media Use and Adolescent Mental Health: …"; here the
    // phrase is the topic, written in this paper's own abstract.
    const p: Paper = {
      ...paper,
      abstract: `${paper.abstract} We discuss social media use and adolescent mental health together.`,
    };
    const text = "Reviews social media use and adolescent mental health links.";
    expect(check(good({ overview: text }), p).failures).toEqual([]);
  });

  it("does not treat single title words as a copied title", () => {
    expect(check(good({ relevanceReason: "Social media and mental health" })).failures).toEqual([]);
  });

  it.each([
    "As shown by Smith et al. here.",
    "Consistent with (Smith, 2020).",
    "Consistent with (Smith 2020).",
  ])("fails on a citation pattern: %s", (text) => {
    expect(check(good({ whyItMatters: text })).failures.join(" ")).toMatch(/citation/i);
  });

  it("fails on a year that is not in the source, but allows the paper's own year", () => {
    expect(
      check(good({ overview: "Data collected in 1999 from teens." })).failures.join(" "),
    ).toMatch(/year/i);
    expect(check(good({ overview: "Published 2020 study of teens." })).failures).toEqual([]);
  });

  it("does not read 2109 as a year", () => {
    expect(check(good({ overview: "A study of 2109 adolescents." })).failures).toEqual([]);
  });

  it("fails when stances do not match the brief's claims exactly", () => {
    const [first, ...rest] = good().stances;
    expect(check(good({ stances: rest })).failures.join(" ")).toMatch(/stance/i);
    expect(
      check(
        good({ stances: [...good().stances, { claimId: "zz", stance: "supports", note: "x" }] }),
      ).failures.join(" "),
    ).toMatch(/stance/i);
    expect(check(good({ stances: [first!, first!, ...rest.slice(1)] })).failures.join(" ")).toMatch(
      /stance/i,
    );
  });

  describe("paper without an abstract", () => {
    const bare = { ...paper, abstract: undefined };
    const ok = good({
      overview: "not stated",
      methodology: "not stated",
      limitations: "not stated",
      stances: context.claims.map((c) => ({
        claimId: c.id,
        stance: "unclear" as const,
        note: "not stated",
      })),
    });

    it("passes when it says not stated and marks every stance unclear", () => {
      expect(check(ok, bare).failures).toEqual([]);
    });

    it("fails when it writes an overview anyway", () => {
      expect(
        check(
          { ...ok, overview: "Teens who use social media more are less happy." },
          bare,
        ).failures.join(" "),
      ).toMatch(/abstract/i);
    });

    it("fails when a stance is not unclear", () => {
      const stances = ok.stances.map((s, i) =>
        i === 0 ? { ...s, stance: "supports" as const } : s,
      );
      expect(check({ ...ok, stances }, bare).failures.join(" ")).toMatch(/abstract/i);
    });
  });

  describe("warnings", () => {
    it("warns on a number the source does not contain", () => {
      expect(check(good({ overview: "A survey of 312 teens." })).warnings.join(" ")).toMatch(/312/);
    });

    it("ignores digits inside words such as claim ids (live false alarm)", () => {
      expect(check(good({ whyItMatters: "Bears directly on c1 and claim c2." })).warnings).toEqual(
        [],
      );
    });

    it("accepts 2,109 and 2109 when the source has 2109", () => {
      expect(check(good({ overview: "A survey of 2,109 teens." })).warnings).toEqual([]);
    });

    it("warns when the model needed a repair retry", () => {
      expect(check(good(), paper, true).warnings.join(" ")).toMatch(/repair/i);
    });

    it("warns when a field is within one word of its limit", () => {
      const words = (n: number) => Array.from({ length: n }, () => "teen").join(" ");
      expect(check(good({ overview: words(35) })).warnings.join(" ")).toMatch(/overview/);
      expect(check(good({ overview: words(34) })).warnings.join(" ")).toMatch(/overview/);
      expect(check(good({ overview: words(33) })).warnings).toEqual([]);
    });

    it("never warns about not stated fields or notes on unclear stances", () => {
      const stances = good().stances.map((s) => ({
        ...s,
        stance: "unclear" as const,
        note: "Shows 999 cases",
      }));
      expect(check(good({ stances, limitations: "not stated" })).warnings).toEqual([]);
    });
  });

  it("skips short surnames and surnames that are ordinary words in the abstract", () => {
    const p: Paper = { ...paper, authors: [{ name: "Wei Li" }, { name: "Sam Social" }] };
    expect(check(good({ whyItMatters: "Li reports social effects." }), p).failures).toEqual([]);
  });
});

describe("formatEvalReport", () => {
  it("prints one line per paper and the totals", () => {
    const rows: EvalRow[] = [
      {
        paperId: "openalex-W1",
        relevance: 80,
        repaired: false,
        issues: { failures: [], warnings: [] },
      },
      {
        paperId: "openalex-W2",
        relevance: 20,
        repaired: false,
        issues: { failures: ["author surname"], warnings: [] },
      },
    ];
    const report = formatEvalReport(rows, { input: 10, output: 5, cacheRead: 3 });
    expect(report).toMatch(/PASS.*openalex-W1/);
    expect(report).toMatch(/FAIL.*openalex-W2/);
    expect(report).toContain(
      "papers 2, passed 1, failures 1, warnings 0, repaired 0, tokens in 10 / out 5 / cache 3",
    );
  });

  it("counts a model error as a failure", () => {
    const rows: EvalRow[] = [
      { paperId: "x", repaired: false, issues: { failures: [], warnings: [] }, error: "refused" },
    ];
    const report = formatEvalReport(rows, { input: 0, output: 0, cacheRead: 0 });
    expect(report).toMatch(/^FAIL\s+x\b/m);
    expect(report).toMatch(/^\s+error: refused$/m);
    expect(report).toContain("passed 0, failures 1");
  });
});
