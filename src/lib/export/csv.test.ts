import { describe, expect, it } from "vitest";
import type { Paper, PaperAnalysis } from "@/types/domain";
import { citeKeys } from "./cite-key";
import { csvExport } from "./csv";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1",
  source: "openalex",
  externalId: "W1",
  doi: "10.1/x",
  title: "Social media use",
  authors: [{ name: "Maartje Boer" }, { name: "Gonneke Stevens" }],
  year: 2020,
  venue: "Computers in Human Behavior",
  url: "https://example.org/p1",
  citationCount: 42,
  isPeerReviewed: true,
  topics: [],
  ...over,
});

const analysis = (over: Partial<PaperAnalysis> = {}): PaperAnalysis => ({
  paperId: "p1",
  projectId: "proj",
  overview: "A longitudinal study.",
  whyItMatters: "Shows direction of effects.",
  relevance: 87,
  relevanceReason: "On topic.",
  stances: [],
  methodology: "Panel",
  limitations: "Self-report",
  useAs: "evidence",
  ...over,
});

const HEADER =
  "cite_key,title,authors,year,venue,doi,url,citations,peer_reviewed,use_as,relevance,why_it_matters,overview";

const rows = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

describe("csvExport", () => {
  it("starts with a BOM and a header, one CRLF row per paper", () => {
    const papers = [paper()];
    const csv = csvExport(papers, citeKeys(papers), new Map([["p1", analysis()]]));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(rows(csv)).toEqual([
      HEADER,
      "boer2020social,Social media use,Maartje Boer; Gonneke Stevens,2020,Computers in Human Behavior,10.1/x,https://example.org/p1,42,yes,evidence,87,Shows direction of effects.,A longitudinal study.",
      "",
    ]);
  });

  it("leaves analysis and missing metadata cells empty", () => {
    const papers = [
      paper({
        authors: [],
        year: undefined,
        venue: undefined,
        doi: undefined,
        url: undefined,
        citationCount: undefined,
        isPeerReviewed: undefined,
      }),
    ];
    expect(rows(csvExport(papers, citeKeys(papers), new Map()))[1]).toBe(
      "anonndsocial,Social media use,,,,,,,,,,,",
    );
  });

  it("quotes commas, quotes and newlines", () => {
    const papers = [paper({ title: 'Teens, "screens"\nand sleep' })];
    const csv = csvExport(
      papers,
      citeKeys(papers),
      new Map([["p1", analysis({ overview: "Line one,\nline two" })]]),
    );
    // Titles are one line in every export; analysis text keeps its breaks, quoted.
    expect(csv).toContain(',"Teens, ""screens"" and sleep",');
    expect(csv).toContain('"Line one,\nline two"\r\n');
  });

  it("neutralises cells that spreadsheets would run as formulas", () => {
    const papers = [paper({ title: '=HYPERLINK("http://evil","x")', venue: "+1 Journal" })];
    const csv = csvExport(papers, citeKeys(papers), new Map());
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(",'+1 Journal,");
    const tagged = [paper({ authors: [{ name: "@admin" }, { name: "-x" }] })];
    expect(csvExport(tagged, citeKeys(tagged), new Map())).toContain(",'@admin; -x,");
  });

  it("strips HTML tags from titles", () => {
    const papers = [paper({ title: "<i>E. coli</i> growth" })];
    expect(csvExport(papers, citeKeys(papers), new Map())).toContain(",E. coli growth,");
  });

  it("is just the header for an empty library", () => {
    expect(rows(csvExport([], new Map(), new Map()))).toEqual([HEADER, ""]);
  });

  it("neutralises formulas hidden behind spaces or in fullwidth form", () => {
    const papers = [paper({ title: " =1+1", venue: "＝SUM(A1)" })];
    const csv = csvExport(papers, citeKeys(papers), new Map());
    expect(csv).toContain(",'=1+1,"); // plainText trims the title first
    expect(csv).toContain(",'＝SUM(A1),");
    const spaced = [paper()];
    const withAnalysis = csvExport(
      spaced,
      citeKeys(spaced),
      new Map([["p1", analysis({ whyItMatters: "  @cmd" })]]),
    );
    expect(withAnalysis).toContain(",'  @cmd,");
  });

  it("uses the vetted http(s) link only", () => {
    const papers = [paper({ url: "javascript:alert(1)" })];
    expect(csvExport(papers, citeKeys(papers), new Map())).toContain(
      ",10.1/x,https://doi.org/10.1/x,",
    );
  });
});
