import { describe, expect, it } from "vitest";
import type { Paper } from "@/types/domain";
import { formatAuthorList, normaliseDoi, orNotStated, paperLinks } from "./detail-format";

const authors = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Author ${i + 1}` }));

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "openalex-W1",
  source: "openalex",
  externalId: "W1",
  title: "T",
  authors: [],
  topics: [],
  ...over,
});

describe("formatAuthorList", () => {
  it("says not stated for no authors", () => {
    expect(formatAuthorList([])).toBe("Authors not stated");
  });
  it("skips blank names", () => {
    expect(formatAuthorList([{ name: "  " }, { name: "Ada Lovelace" }])).toBe("Ada Lovelace");
  });
  it("joins two with and", () => {
    expect(formatAuthorList(authors(2))).toBe("Author 1 and Author 2");
  });
  it("lists up to the max in full", () => {
    expect(formatAuthorList(authors(8))).toBe(
      "Author 1, Author 2, Author 3, Author 4, Author 5, Author 6, Author 7 and Author 8",
    );
  });
  it("cuts off beyond the max", () => {
    expect(formatAuthorList(authors(9))).toBe(
      "Author 1, Author 2, Author 3, Author 4, Author 5, Author 6, Author 7, Author 8 and 1 more",
    );
    expect(formatAuthorList(authors(30), 3)).toBe("Author 1, Author 2, Author 3 and 27 more");
  });
});

describe("normaliseDoi", () => {
  it.each([
    ["10.1000/xyz", "10.1000/xyz"],
    ["  10.1000/XYZ ", "10.1000/XYZ"],
    ["doi:10.1000/xyz", "10.1000/xyz"],
    ["DOI: 10.1000/xyz", "10.1000/xyz"],
    ["https://doi.org/10.1000/xyz", "10.1000/xyz"],
    ["http://dx.doi.org/10.1000/xyz", "10.1000/xyz"],
    ["https://www.doi.org/10.1000/xyz", "10.1000/xyz"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseDoi(input)).toBe(expected);
  });
  it("rejects things that are not DOIs", () => {
    expect(normaliseDoi("")).toBeUndefined();
    expect(normaliseDoi(undefined)).toBeUndefined();
    expect(normaliseDoi("not a doi")).toBeUndefined();
  });
});

describe("paperLinks", () => {
  it("returns nothing for a paper without links", () => {
    expect(paperLinks(paper())).toEqual([]);
  });

  it("links the DOI and drops a url that is the same DOI link", () => {
    expect(paperLinks(paper({ doi: "10.1000/xyz", url: "https://doi.org/10.1000/XYZ" }))).toEqual([
      { kind: "doi", label: "10.1000/xyz", href: "https://doi.org/10.1000/xyz" },
    ]);
  });

  it("keeps a distinct landing page and a PDF, page first", () => {
    expect(
      paperLinks(
        paper({
          doi: "doi:10.1000/xyz",
          url: "https://example.org/paper",
          pdfUrl: "https://example.org/paper.pdf",
        }),
      ),
    ).toEqual([
      { kind: "page", label: "Open paper", href: "https://example.org/paper" },
      { kind: "doi", label: "10.1000/xyz", href: "https://doi.org/10.1000/xyz" },
      { kind: "pdf", label: "PDF", href: "https://example.org/paper.pdf" },
    ]);
  });

  it("encodes DOIs with reserved characters", () => {
    expect(
      paperLinks(paper({ doi: "10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-#" }))[0]
        ?.href,
    ).toBe(
      "https://doi.org/10.1002/(SICI)1097-4571(199806)49%3A8%3C693%3A%3AAID-ASI4%3E3.0.CO%3B2-%23",
    );
  });

  it("keeps a PDF whose path differs only by case", () => {
    expect(
      paperLinks(
        paper({ url: "https://example.org/paper.pdf", pdfUrl: "https://example.org/Paper.pdf" }),
      ),
    ).toHaveLength(2);
  });

  it("drops unsafe and relative URLs", () => {
    expect(paperLinks(paper({ url: "javascript:alert(1)", pdfUrl: "/files/a.pdf" }))).toEqual([]);
  });

  it("drops a PDF identical to the landing page", () => {
    expect(
      paperLinks(paper({ url: "https://example.org/a.pdf", pdfUrl: "https://example.org/a.pdf" })),
    ).toEqual([{ kind: "page", label: "Open paper", href: "https://example.org/a.pdf" }]);
  });
});

describe("orNotStated", () => {
  it.each([undefined, "", "   ", "not stated", " Not stated. "])("%j → undefined", (input) => {
    expect(orNotStated(input)).toBeUndefined();
  });
  it("trims real text", () => {
    expect(orNotStated("  Survey of 272 teens. ")).toBe("Survey of 272 teens.");
  });
});
