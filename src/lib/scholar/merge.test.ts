import { describe, expect, it } from "vitest";
import type { Paper } from "@/types/domain";
import { enrichPapers, keepCachedFields, type S2Enrichment } from "./merge";

const paper = (id: string, over: Partial<Paper> = {}): Paper =>
  Object.freeze({
    id: `openalex-${id}`,
    source: "openalex",
    externalId: id,
    title: `Paper ${id}`,
    authors: [{ name: "A. Author" }],
    topics: ["Topic"],
    year: 2022,
    citationCount: 12,
    isPeerReviewed: true,
    doi: `10.1/${id.toLowerCase()}`,
    ...over,
  }) as Paper;

const lookup = (entries: Record<string, S2Enrichment>) => new Map(Object.entries(entries));

describe("enrichPapers", () => {
  it("adds the S2 tldr and keeps every OpenAlex field", () => {
    const input = paper("W1", { abstract: "OpenAlex abstract." });
    const [out] = enrichPapers([input], lookup({ "10.1/w1": { tldr: "Short.", abstract: "S2" } }));
    expect(out).toEqual({ ...input, tldr: "Short." });
    expect(input).not.toHaveProperty("tldr");
  });

  it("fills a missing abstract from S2", () => {
    const [out] = enrichPapers([paper("W1")], lookup({ "10.1/w1": { abstract: "S2 abstract." } }));
    expect(out!.abstract).toBe("S2 abstract.");
  });

  it("leaves papers without a DOI or unknown to S2 untouched, in order", () => {
    const noDoi = paper("W1", { doi: undefined });
    const unknown = paper("W2");
    const known = paper("W3");
    const out = enrichPapers([noDoi, unknown, known], lookup({ "10.1/w3": { tldr: "T" } }));
    expect(out.map((p) => p.id)).toEqual(["openalex-W1", "openalex-W2", "openalex-W3"]);
    expect(out[0]).toEqual(noDoi);
    expect(out[1]).toEqual(unknown);
    expect(out[2]!.tldr).toBe("T");
  });

  it("enriches every paper that shares a DOI", () => {
    const a = paper("W1", { doi: "10.1/same" });
    const b = paper("W2", { doi: "10.1/same" });
    const out = enrichPapers([a, b], lookup({ "10.1/same": { tldr: "T" } }));
    expect(out.map((p) => p.tldr)).toEqual(["T", "T"]);
  });

  it("ignores empty or whitespace-only S2 text", () => {
    const [out] = enrichPapers([paper("W1")], lookup({ "10.1/w1": { tldr: "  ", abstract: "" } }));
    expect(out).not.toHaveProperty("tldr");
    expect(out).not.toHaveProperty("abstract");
  });
});

describe("keepCachedFields", () => {
  it("keeps a cached tldr and abstract the new paper lacks", () => {
    const out = keepCachedFields(paper("W1"), { tldr: "Cached.", abstract: "Cached abstract." });
    expect(out.tldr).toBe("Cached.");
    expect(out.abstract).toBe("Cached abstract.");
  });

  it("prefers the new paper's own values", () => {
    const out = keepCachedFields(paper("W1", { tldr: "New.", abstract: "New abstract." }), {
      tldr: "Old.",
      abstract: "Old abstract.",
    });
    expect(out.tldr).toBe("New.");
    expect(out.abstract).toBe("New abstract.");
  });

  it.each([null, undefined, [], "text", { tldr: 5, abstract: ["x"] }, { tldr: "  " }])(
    "ignores a junk cached row %j",
    (cached) => {
      const input = paper("W1");
      expect(keepCachedFields(input, cached)).toEqual(input);
    },
  );
});
