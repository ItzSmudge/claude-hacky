import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { Paper } from "@/types/domain";
import { buildEntry, escapeLatex, latexTitle, rekeyEntry } from "./bibtex";
import { citeKeys } from "./cite-key";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1",
  source: "openalex",
  externalId: "W1",
  doi: "10.1016/j.chb.2020.106645",
  title: "Social media use intensity",
  authors: [{ name: "Maartje Boer" }, { name: "Gonneke W. J. M. Stevens" }],
  year: 2020,
  venue: "Computers in Human Behavior",
  url: "https://doi.org/10.1016/j.chb.2020.106645",
  topics: [],
  ...over,
});

/** True when every { has a matching } (ignoring escaped ones). */
const balanced = (text: string) => {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth < 0) return false;
  }
  return depth === 0;
};

describe("escapeLatex", () => {
  it("escapes every LaTeX special character", () => {
    expect(escapeLatex("A & B 50% $5 #1 a_b {x} ~ ^ \\")).toBe(
      "A \\& B 50\\% \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
    );
  });
});

describe("latexTitle", () => {
  it("braces words with inner or all capitals so styles keep their case", () => {
    expect(latexTitle("Mental health in the UK during COVID-19 and iPhone use")).toBe(
      "Mental health in the {UK} during {COVID-19} and {iPhone} use",
    );
  });

  it("leaves ordinary title-case words alone", () => {
    expect(latexTitle("Social Media Use")).toBe("Social Media Use");
  });
});

describe("buildEntry", () => {
  it("builds an @article with one field per line", () => {
    expect(buildEntry(paper(), "boer2020social")).toBe(
      [
        "@article{boer2020social,",
        "  author = {Maartje Boer and Gonneke W. J. M. Stevens},",
        "  title = {Social media use intensity},",
        "  journal = {Computers in Human Behavior},",
        "  year = {2020},",
        "  doi = {10.1016/j.chb.2020.106645},",
        "  url = {https://doi.org/10.1016/j.chb.2020.106645},",
        "}",
      ].join("\n"),
    );
  });

  it("uses @misc without a venue and leaves out missing fields", () => {
    const entry = buildEntry(
      paper({ venue: undefined, year: undefined, doi: undefined, url: undefined, authors: [] }),
      "anonndsocial",
    );
    expect(entry).toBe("@misc{anonndsocial,\n  title = {Social media use intensity},\n}");
  });

  it("falls back to a doi.org url when the paper has a DOI but no url", () => {
    expect(buildEntry(paper({ url: undefined }), "k")).toContain(
      "url = {https://doi.org/10.1016/j.chb.2020.106645}",
    );
  });

  it("escapes titles, venues and names", () => {
    const entry = buildEntry(
      paper({
        title: "Risk & resilience: 50% of {teens}",
        venue: "Journal of Health_Data",
        authors: [{ name: "Anne O'Neil & co" }],
      }),
      "k",
    );
    expect(entry).toContain("title = {Risk \\& resilience: 50\\% of \\{teens\\}}");
    expect(entry).toContain("journal = {Journal of Health\\_Data}");
    expect(entry).toContain("author = {Anne O'Neil \\& co}");
  });

  it("braces organisation authors so BibTeX doesn't split them", () => {
    const entry = buildEntry(
      paper({ authors: [{ name: "World Health Organization" }, { name: "Jane Doe" }] }),
      "k",
    );
    expect(entry).toContain("author = {{World Health Organization} and Jane Doe}");
  });

  it("produces balanced braces for every fixture paper", () => {
    const papers = fixturePapers.map((entry) => entry.paper);
    const keys = citeKeys(papers);
    for (const p of papers) {
      const entry = buildEntry(p, keys.get(p.id)!);
      expect(balanced(entry), entry).toBe(true);
      expect(entry).toMatch(/^@(article|misc)\{[a-z0-9]+,\n/);
    }
  });
});

// Recorded shape of a Crossref answer from doi.org: one line, leading space, its own key.
const CROSSREF =
  " @article{Boer_2020, title={Social media use intensity, social media use problems, and mental health among adolescents: Investigating directionality and mediating processes}, volume={116}, ISSN={0747-5632}, url={http://dx.doi.org/10.1016/j.chb.2020.106645}, DOI={10.1016/j.chb.2020.106645}, journal={Computers in Human Behavior}, publisher={Elsevier BV}, author={Boer, Maartje and Stevens, Gonneke W.J.M. and Finkenauer, Catrin and van den Eijnden, Regina J.J.M.}, year={2021}, month=mar, pages={106645} }";

// DataCite-style answer: multi-line, quoted values.
const DATACITE = `@misc{https://doi.org/10.5281/zenodo.1,
  doi = {10.5281/ZENODO.1},
  url = "https://zenodo.org/record/1",
  author = {Doe, Jane},
  title = "A {Zenodo} record",
  year = {2024}
}
`;

describe("rekeyEntry", () => {
  it("re-keys a Crossref entry and puts one field per line", () => {
    const entry = rekeyEntry(CROSSREF, "boer2020social");
    expect(entry).not.toBeNull();
    const lines = entry!.split("\n");
    expect(lines[0]).toBe("@article{boer2020social,");
    expect(lines).toContain("  doi = {10.1016/j.chb.2020.106645},");
    expect(lines).toContain("  month = mar,");
    expect(lines).toContain(
      "  author = {Boer, Maartje and Stevens, Gonneke W.J.M. and Finkenauer, Catrin and van den Eijnden, Regina J.J.M.},",
    );
    expect(lines.at(-1)).toBe("}");
    expect(balanced(entry!)).toBe(true);
  });

  it("re-keys a multi-line entry with quoted values and a URL as its key", () => {
    const entry = rekeyEntry(DATACITE, "doe2024zenodo");
    expect(entry).toBe(
      [
        "@misc{doe2024zenodo,",
        "  doi = {10.5281/ZENODO.1},",
        '  url = "https://zenodo.org/record/1",',
        "  author = {Doe, Jane},",
        '  title = "A {Zenodo} record",',
        "  year = {2024},",
        "}",
      ].join("\n"),
    );
  });

  it.each([
    ["HTML", "<!doctype html><html><body>DOI Not Found</body></html>"],
    ["empty text", "   "],
    ["two entries", `${CROSSREF}\n${CROSSREF}`],
    ["unbalanced braces", "@article{x, title={Broken}"],
    ["trailing junk", "@article{x, title={T}} extra"],
    ["no fields", "@article{x,}"],
    ["no title", "@article{x, year={2020}}"],
    ["string concatenation", '@article{x, title={T} # "more"}'],
    ["a @comment", "@comment{nothing here}"],
  ])("rejects %s", (_label, text) => {
    expect(rekeyEntry(text, "k")).toBeNull();
  });

  it("rejects entries carrying dangerous TeX primitives", () => {
    expect(rekeyEntry("@article{x, title={Hi \\immediate\\write18{rm -rf ~}}}", "k")).toBeNull();
    expect(rekeyEntry("@article{x, title={\\input{/etc/passwd}}}", "k")).toBeNull();
  });

  it("keeps ordinary TeX accents and commands", () => {
    const entry = rekeyEntry("@article{x, title={Sch{\\o}nning and \\textit{in vivo}}}", "k");
    expect(entry).toContain("title = {Sch{\\o}nning and \\textit{in vivo}}");
  });
});
