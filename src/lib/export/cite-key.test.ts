import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import type { Paper } from "@/types/domain";
import { asciiFold, citeKey, citeKeys, familyName } from "./cite-key";

const paper = (over: Partial<Paper> = {}): Paper => ({
  id: "p1",
  source: "openalex",
  externalId: "W1",
  title: "Social media use and adolescent wellbeing",
  authors: [{ name: "Maartje Boer" }],
  year: 2020,
  topics: [],
  ...over,
});

describe("asciiFold", () => {
  it("strips diacritics and maps letters NFD can't split", () => {
    expect(asciiFold("Schønning")).toBe("Schonning");
    expect(asciiFold("Finserås")).toBe("Finseras");
    expect(asciiFold("Æsir Straße Łódź þorn")).toBe("AEsir Strasse Lodz thorn");
  });
});

describe("familyName", () => {
  it("takes the last word of a 'First Last' name", () => {
    expect(familyName("Turi Reiten Finserås")).toBe("Finserås");
  });

  it("takes the part before the comma of a 'Last, First' name", () => {
    expect(familyName("Underwood, Lydia")).toBe("Underwood");
  });

  it("skips generational suffixes", () => {
    expect(familyName("Martin Luther King Jr.")).toBe("King");
    expect(familyName("John Smith III")).toBe("Smith");
  });

  it("returns an empty string for a blank name", () => {
    expect(familyName("   ")).toBe("");
  });
});

describe("citeKey", () => {
  it("builds lastnameYEARword", () => {
    expect(citeKey(paper())).toBe("boer2020social");
  });

  it("skips stopwords and punctuation for the title word", () => {
    expect(citeKey(paper({ title: "The 'Impact' of Social Media" }))).toBe("boer2020impact");
    expect(citeKey(paper({ title: "A trans-diagnostic model" }))).toBe("boer2020transdiagnostic");
  });

  it("falls back to nd, anon and untitled", () => {
    expect(citeKey(paper({ year: undefined }))).toBe("boerndsocial");
    expect(citeKey(paper({ authors: [] }))).toBe("anon2020social");
    expect(citeKey(paper({ authors: [{ name: "王小明" }] }))).toBe("anon2020social");
    expect(citeKey(paper({ title: "On the of" }))).toBe("boer2020untitled");
  });

  it("folds diacritics in the family name", () => {
    expect(citeKey(paper({ authors: [{ name: "Viktor Schønning" }] }))).toBe("schonning2020social");
  });
});

describe("citeKeys", () => {
  it("suffixes collisions b, c… by paper id, whatever the input order", () => {
    const a = paper({ id: "a" });
    const b = paper({ id: "b" });
    const c = paper({ id: "c" });
    const expected = new Map([
      ["a", "boer2020social"],
      ["b", "boer2020socialb"],
      ["c", "boer2020socialc"],
    ]);
    expect(citeKeys([c, a, b])).toEqual(expected);
    expect(citeKeys([b, c, a])).toEqual(expected);
  });

  it("does not collide with a key that already ends in a suffix letter", () => {
    const keys = citeKeys([
      paper({ id: "a" }),
      paper({ id: "b" }),
      paper({ id: "c", title: "Socialb networks" }),
    ]);
    expect(new Set(keys.values()).size).toBe(3);
  });

  it("gives every fixture paper a unique, well-formed key", () => {
    const papers = fixturePapers.map((entry) => entry.paper);
    const keys = citeKeys(papers);
    expect(keys.size).toBe(papers.length);
    expect(new Set(keys.values()).size).toBe(papers.length);
    for (const key of keys.values()) expect(key).toMatch(/^[a-z]+(\d{4}|nd)[a-z]+$/);
    expect(keys.get("openalex-W7110479187")).toBe("underwood2024difference");
    expect(keys.get("openalex-W4387900607")).toBe("finseras2023reexploring");
  });
});
