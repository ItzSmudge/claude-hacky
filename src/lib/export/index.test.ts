import { describe, expect, it, vi } from "vitest";
import type { Paper } from "@/types/domain";
import { bibtexFor } from "./index";

const paper = (id: string, over: Partial<Paper> = {}): Paper => ({
  id,
  source: "openalex",
  externalId: id,
  title: `Paper ${id}`,
  authors: [{ name: `Author ${id.toUpperCase()}` }],
  year: 2020,
  venue: "Journal",
  topics: [],
  ...over,
});

const crossref = (title: string) =>
  new Response(` @article{Crossref_2020, title={${title}}, year={2020}}`, {
    status: 200,
    headers: { "content-type": "application/x-bibtex" },
  });

describe("bibtexFor", () => {
  it("uses doi.org entries where they validate and builds the rest", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith("/10.1/good")
        ? crossref("From Crossref")
        : new Response("<html>", { status: 200 }),
    );
    const result = await bibtexFor(
      [
        paper("a", { doi: "10.1/good" }),
        paper("b", { doi: "10.1/html" }),
        paper("c"), // no DOI: never fetched
      ],
      { fetch },
    );
    expect(result.fromDoi).toBe(1);
    expect(result.built).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.text).toContain("@article{a2020paper,\n  title = {From Crossref},");
    expect(result.text).toContain("@article{b2020paper,\n  author = {Author B},");
    expect(result.text).toContain("@article{c2020paper,");
  });

  it("orders entries by cite key and starts with a comment header", async () => {
    const { text } = await bibtexFor([paper("c"), paper("a"), paper("b")], {
      fetch: vi.fn(),
    });
    expect(text.startsWith("% ")).toBe(true);
    const keys = [...text.matchAll(/^@\w+\{([^,]+),/gm)].map((m) => m[1]);
    expect(keys).toEqual(["a2020paper", "b2020paper", "c2020paper"]);
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("returns just the header for an empty library", async () => {
    const result = await bibtexFor([], { fetch: vi.fn() });
    expect(result).toEqual({ text: expect.stringMatching(/^% .*\n$/), fromDoi: 0, built: 0 });
  });

  it("builds entries still pending when the export deadline passes", async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const papers = Array.from({ length: 6 }, (_, i) => paper(`p${i}`, { doi: `10.1/p${i}` }));
    const result = await bibtexFor(papers, { fetch, deadlineMs: 20 });
    expect(result).toMatchObject({ fromDoi: 0, built: 6 });
  });

  it("fetches at most 4 DOIs at once", async () => {
    let active = 0;
    let peak = 0;
    const fetch = vi.fn(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return crossref("T");
    });
    const papers = Array.from({ length: 10 }, (_, i) => paper(`p${i}`, { doi: `10.1/p${i}` }));
    const result = await bibtexFor(papers, { fetch });
    expect(result.fromDoi).toBe(10);
    expect(peak).toBe(4);
  });
});
