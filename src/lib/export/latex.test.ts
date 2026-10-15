import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { Paper } from "@/types/domain";
import { citeKeys } from "./cite-key";
import { citeCommand, latexBibliography } from "./latex";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1",
  source: "openalex",
  externalId: "W1",
  doi: "10.1/x",
  title: "Social media use",
  authors: [{ name: "Maartje Boer" }, { name: "Gonneke Stevens" }],
  year: 2020,
  venue: "Computers in Human Behavior",
  topics: [],
  ...over,
});

const keysFor = (papers: Paper[]) => citeKeys(papers);

describe("citeCommand", () => {
  it("joins keys into one \\cite", () => {
    expect(citeCommand(["a2020x", "b2021y"])).toBe("\\cite{a2020x,b2021y}");
  });

  it("is empty for no keys", () => {
    expect(citeCommand([])).toBe("");
  });
});

describe("latexBibliography", () => {
  it("renders one \\bibitem per paper with newblocks", () => {
    const papers = [paper()];
    expect(latexBibliography(papers, keysFor(papers))).toBe(
      [
        "% 1 reference exported from PaperCut. Needs \\usepackage{url}.",
        "\\begin{thebibliography}{9}",
        "",
        "\\bibitem{boer2020social}",
        "Maartje Boer and Gonneke Stevens.",
        "\\newblock Social media use.",
        "\\newblock \\emph{Computers in Human Behavior}, 2020.",
        "\\newblock \\url{https://doi.org/10.1/x}.",
        "",
        "\\end{thebibliography}",
        "",
      ].join("\n"),
    );
  });

  it("lists up to 6 authors with an Oxford 'and', then switches to et al.", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Ann Lee${i}` }));
    const three = [paper({ authors: names(3) })];
    expect(latexBibliography(three, keysFor(three))).toContain("Ann Lee0, Ann Lee1, and Ann Lee2.");
    const seven = [paper({ authors: names(7) })];
    expect(latexBibliography(seven, keysFor(seven))).toContain("}\nAnn Lee0 et~al.\n");
  });

  it("skips missing parts without stray punctuation", () => {
    const bare = [
      paper({ authors: [], venue: undefined, year: undefined, doi: undefined, url: undefined }),
    ];
    const text = latexBibliography(bare, keysFor(bare));
    expect(text).toContain("\\bibitem{anonndsocial}\nSocial media use.\n\n\\end");
  });

  it("keeps a title's own end punctuation and escapes specials", () => {
    const papers = [paper({ title: "Is 50% <i>too</i> much? R&D_x", venue: "J. Health & Care" })];
    const text = latexBibliography(papers, keysFor(papers));
    expect(text).toContain("\\newblock Is 50\\% too much? R\\&D\\_x.");
    expect(text).toContain("\\newblock \\emph{J. Health \\& Care}, 2020.");
    const question = [paper({ title: "Does it matter?" })];
    expect(latexBibliography(question, keysFor(question))).toContain(
      "\\newblock Does it matter?\n",
    );
  });

  it("orders items by cite key and widens the label to the item count", () => {
    const papers = Array.from({ length: 12 }, (_, i) =>
      paper({ id: `p${i}`, authors: [{ name: `Ann ${String.fromCharCode(108 - i)}` }] }),
    );
    const text = latexBibliography(papers, keysFor(papers));
    expect(text).toContain("\\begin{thebibliography}{99}");
    const keys = [...text.matchAll(/\\bibitem\{([^}]+)\}/g)].map((m) => m[1]);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toHaveLength(12);
  });

  it("is a comment only when nothing is saved (an empty environment won't compile)", () => {
    expect(latexBibliography([], new Map())).toBe("% Nothing saved yet.\n");
  });

  it("produces balanced braces for every fixture paper", () => {
    const papers = fixturePapers.map((entry) => entry.paper);
    const text = latexBibliography(papers, keysFor(papers));
    let depth = 0;
    for (const ch of text.replace(/\\[{}]/g, "")) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});
