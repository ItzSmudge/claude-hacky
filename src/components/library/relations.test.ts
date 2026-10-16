import { describe, expect, it } from "vitest";
import fixture from "@/lib/ai/__fixtures__/relations.json";
import { projectRelationsSchema, type ProjectRelations } from "@/lib/ai/schemas";
import { resolveRelations, type RelationPaper } from "./relations";

const relations = projectRelationsSchema.parse(fixture);
const ids = [
  "openalex-W2908500884",
  "openalex-W3110709293",
  "openalex-W3195706482",
  "openalex-W4393176161",
  "openalex-W4412412329",
];
const papers: RelationPaper[] = ids.map((id, i) => ({
  id,
  title: `Title ${i}`,
  year: 2020 + i,
  citeKey: `key${i}`,
}));
const claims = [
  { id: "c1", text: "Heavy use harms wellbeing" },
  { id: "c2", text: "Effects are small" },
  { id: "c3", text: "Skills help" },
];

describe("resolveRelations", () => {
  it("splits claims into debated and one-sided, keeping brief order", () => {
    const r = resolveRelations(relations, papers, claims);
    expect(r.debated.map((c) => c.claim.id)).toEqual(["c1"]);
    expect(r.debated[0].supports.map((p) => p.id)).toEqual(["openalex-W2908500884"]);
    expect(r.debated[0].challenges).toHaveLength(2);
    expect(r.oneSided.map((c) => [c.claim.id, c.supports.length, c.challenges.length])).toEqual([
      ["c2", 4, 0],
      ["c3", 1, 0],
    ]);
  });

  it("resolves methods and pairs to code-made paper refs", () => {
    const r = resolveRelations(relations, papers, claims);
    expect(r.methods).toHaveLength(2);
    expect(r.methods[0].papers.map((p) => p.title)).toEqual(["Title 2", "Title 3"]);
    expect(r.pairs).toHaveLength(3);
    expect(r.pairs[0]).toMatchObject({ kind: "contrast", a: { title: "Title 1" } });
  });

  it("drops unknown ids, short method groups, one-sided pairs and unknown claims", () => {
    const tampered: ProjectRelations = {
      ...relations,
      claims: [...relations.claims, { claimId: "c9", supports: ids, challenges: ids }],
      methods: [{ label: "Made up", paperIds: ["openalex-W2908500884", "openalex-Wfake"] }],
      pairs: [{ a: ids[0], b: "openalex-Wfake", kind: "complement", note: "x" }],
    };
    const r = resolveRelations(tampered, papers, claims);
    expect(r.methods).toEqual([]);
    expect(r.pairs).toEqual([]);
    expect([...r.debated, ...r.oneSided].map((c) => c.claim.id)).not.toContain("c9");
  });

  it("drops unknown ids inside claim groups and skips claims nobody takes a side on", () => {
    const r = resolveRelations(
      {
        ...relations,
        claims: [
          { claimId: "c1", supports: ["openalex-Wfake"], challenges: [ids[1]] },
          { claimId: "c2", supports: [], challenges: [] },
        ],
      },
      papers,
      claims,
    );
    expect(r.debated).toEqual([]);
    expect(r.oneSided.map((c) => [c.claim.id, c.supports.length, c.challenges.length])).toEqual([
      ["c1", 0, 1],
    ]);
  });
});
