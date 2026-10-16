import { describe, expect, it } from "vitest";
import { paperSchema } from "@/lib/api-schemas";
import { fixturePapers } from "@/fixtures";
import recorded from "./__fixtures__/semanticscholar-papers.json";
import { s2PaperToPaper, type S2Paper } from "./semanticscholar";

const papers = recorded.papers as unknown as Record<string, S2Paper>;

describe("s2PaperToPaper", () => {
  it("maps the recorded paper to the same bibliographic data as src/fixtures", () => {
    const paper = s2PaperToPaper(papers.real!)!;
    const fixture = fixturePapers.find((e) => e.paper.id === "openalex-W3110709293")!.paper;
    expect(paper.id).toBe("semanticscholar-4dbdefe3d0f5ccae521c12b80a7d666932dc504b");
    expect(paper.source).toBe("semanticscholar");
    expect(paper.externalId).toBe("4dbdefe3d0f5ccae521c12b80a7d666932dc504b");
    expect(paper.doi).toBe(fixture.doi);
    expect(paper.title).toBe(fixture.title);
    expect(paper.year).toBe(fixture.year);
    expect(paper.authors.map((a) => a.name)).toEqual([
      "M. Boer",
      "G. Stevens",
      "C. Finkenauer",
      "M. D. de Looze",
      "R. van den Eijnden",
    ]);
    expect(paper.venue).toBe("Computers in Human Behavior");
    expect(paper.citationCount).toBeGreaterThanOrEqual(0);
    expect(paper.tldr).toMatch(/^Findings of the study suggest/);
    expect(paper.abstract).toMatch(/^Abstract Social media have become/);
    expect(paper.isPeerReviewed).toBe(true);
    expect(paper.topics).toEqual(["Computer Science", "Psychology"]);
    expect(paper.url).toBe("https://doi.org/10.1016/j.chb.2020.106645");
    expect(paper.pdfUrl).toBe(
      "https://www.sciencedirect.com/science/article/pii/S0747563220303927/pdf",
    );
  });

  it.each(["noTitle", "noId"])("drops the %s paper", (key) => {
    expect(s2PaperToPaper(papers[key]!)).toBeNull();
  });

  it("keeps a sparse paper with optional fields unset", () => {
    const paper = s2PaperToPaper(papers.sparse!)!;
    for (const key of ["doi", "abstract", "tldr", "venue", "pdfUrl"]) {
      expect(paper).not.toHaveProperty(key);
    }
    expect(paper.title).toBe("Sparse Synthetic Paper");
    expect(paper.url).toBe(
      "https://www.semanticscholar.org/paper/9000000000000000000000000000000000000004",
    );
    expect(paper.isPeerReviewed).toBe(false);
    expect(paper.topics).toEqual([]);
    expect(paper.citationCount).toBe(0);
  });

  it("cleans a messy record instead of crashing", () => {
    const paper = s2PaperToPaper(papers.messy!)!;
    expect(paper.authors).toEqual([{ name: "Kept Author" }]);
    expect(paper).not.toHaveProperty("year");
    expect(paper.doi).toBe("10.1/abc");
    expect(paper).not.toHaveProperty("tldr");
    expect(paper.topics).toEqual(["A", "B", "C"]);
    expect(paper.url).toBe("https://doi.org/10.1/abc");
  });

  it("never uses a non-http S2 url", () => {
    expect(s2PaperToPaper(papers.noDoiBadUrl!)).not.toHaveProperty("url");
  });

  it("does not count a repository as peer reviewed", () => {
    expect(s2PaperToPaper(papers.preprint!)!.isPeerReviewed).toBe(false);
  });

  it("produces records that pass paperSchema", () => {
    for (const raw of Object.values(papers)) {
      const paper = s2PaperToPaper(raw);
      if (paper) expect(() => paperSchema.parse(paper)).not.toThrow();
    }
  });
});
