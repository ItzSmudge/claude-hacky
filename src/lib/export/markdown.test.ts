import { describe, expect, it } from "vitest";
import type { Paper, PaperAnalysis } from "@/types/domain";
import { citeKeys } from "./cite-key";
import { markdownReadingList } from "./markdown";

const paper = (id: string, over: Partial<Paper> = {}): Paper => ({
  id,
  source: "openalex",
  externalId: id,
  doi: `10.1/${id}`,
  title: `Paper ${id}`,
  authors: [{ name: `Ann ${id}` }],
  year: 2020,
  venue: "Journal",
  topics: [],
  ...over,
});

const analysis = (
  paperId: string,
  useAs: PaperAnalysis["useAs"],
  relevance: number,
): PaperAnalysis => ({
  paperId,
  projectId: "proj",
  overview: "Overview.",
  whyItMatters: `Why ${paperId}.`,
  relevance,
  relevanceReason: "",
  stances: [],
  methodology: "",
  limitations: "",
  useAs,
});

const list = (papers: Paper[], analyses: PaperAnalysis[], title = "Teen screens") =>
  markdownReadingList(
    title,
    papers,
    citeKeys(papers),
    new Map(analyses.map((a) => [a.paperId, a])),
  );

describe("markdownReadingList", () => {
  it("groups by use, in a fixed order, highest relevance first", () => {
    const papers = ["a", "b", "c", "d", "e"].map((id) => paper(id));
    const md = list(papers, [
      analysis("a", "background", 50),
      analysis("b", "evidence", 60),
      analysis("c", "evidence", 90),
      analysis("d", "counterpoint", 70),
    ]);
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Evidence", "Counterpoints", "Background", "Not analysed yet"]);
    expect(md.indexOf("Paper c")).toBeLessThan(md.indexOf("Paper b"));
    expect(md.startsWith("# Reading list: Teen screens\n")).toBe(true);
  });

  it("renders a paper with its key, link and why it matters", () => {
    const md = list([paper("a")], [analysis("a", "method", 80)]);
    expect(md).toContain(
      [
        "- **Paper a.** Ann a (2020). *Journal.* [doi:10.1/a](https://doi.org/10.1/a)",
        "  `a2020paper`",
        "  Why it matters: Why a.",
      ].join("\n"),
    );
  });

  it("skips missing parts without stray punctuation", () => {
    const md = list(
      [paper("a", { authors: [], year: undefined, venue: undefined, doi: undefined })],
      [],
    );
    expect(md).toContain("- **Paper a.**\n  `anonndpaper`\n");
  });

  it("escapes markdown in data and strips HTML tags", () => {
    const md = list(
      [paper("a", { title: "<i>E. coli</i> *bold* [link](x) `code` _u_", venue: "J_*" })],
      [],
    );
    expect(md).toContain(
      "**E. coli \\*bold\\* \\[link\\](x) \\`code\\` \\_u\\_.** Ann a (2020). *J\\_\\*.*",
    );
  });

  it("escapes markdown in the project title and keeps urls link-safe", () => {
    const md = list([paper("a", { doi: "10.1/a(b)" })], [], "# *Me*");
    expect(md.startsWith("# Reading list: \\# \\*Me\\*\n")).toBe(true);
    expect(md).toContain("[doi:10.1/a(b)](https://doi.org/10.1/a%28b%29)");
  });

  it("says so when nothing is saved", () => {
    expect(list([], [])).toBe("# Reading list: Teen screens\n\nNothing saved yet.\n");
  });

  it("keeps every value on one line so it can't start new markdown blocks", () => {
    const md = list(
      [paper("a", { title: "Title\n\n- injected item\n    code\n---" })],
      [{ ...analysis("a", "evidence", 50), whyItMatters: "Line\n\n# Heading\n1. list" }],
      "Teen\nscreens",
    );
    expect(md.startsWith("# Reading list: Teen screens\n")).toBe(true);
    expect(md).toContain("**Title - injected item code ---.**");
    expect(md).toContain("  Why it matters: Line \\# Heading 1. list");
    expect(md.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(1);
  });

  it("escapes strikethrough, math, images and entities", () => {
    const md = list([paper("a", { title: "~~x~~ $y$ ![i](u) &amp; a=b" })], []);
    expect(md).toContain("**\\~\\~x\\~\\~ \\$y\\$ \\!\\[i\\](u) \\& a\\=b.**");
  });

  it("only links http(s) urls", () => {
    const md = list([paper("a", { doi: undefined, url: "javascript:alert(1)" })], []);
    expect(md).not.toContain("javascript");
    expect(md).not.toContain("](");
  });
});
