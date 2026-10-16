import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import type { Paper, PaperAnalysis } from "@/types/domain";
import fixtureRelations from "./__fixtures__/relations.json";
import { projectRelationsSchema, type RelationsOutput } from "./schemas";

vi.mock("server-only", () => ({}));
const askJson = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ askJson }));

const {
  analyseRelations,
  buildRelationsPrompt,
  finaliseRelations,
  groupByClaim,
  selectPapers,
  MAX_RELATION_PAPERS,
} = await import("./relations");

const { claims, topic } = fixtureProject.context;
const papers = fixturePapers.slice(0, 5).map((f) => f.paper);
const analyses = new Map(fixturePapers.slice(0, 5).map((f) => [f.paper.id, f.analysis]));
const [p1, p2, p3, p4, p5] = papers.map((p) => p.id);

const usage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe("groupByClaim", () => {
  it("lists supporting and challenging papers per claim, in the brief's order", () => {
    expect(
      groupByClaim(
        claims,
        analyses,
        papers.map((p) => p.id),
      ),
    ).toEqual([
      { claimId: "c1", supports: [p3, p4], challenges: [p1, p2] },
      { claimId: "c2", supports: [p1, p3, p5], challenges: [] },
      { claimId: "c3", supports: [], challenges: [] },
    ]);
  });

  it("skips papers without a stored analysis and stances for unknown claims", () => {
    const partial = new Map([[p1!, analyses.get(p1!)!]]);
    expect(groupByClaim(claims.slice(0, 1), partial, [p1!, p3!])).toEqual([
      { claimId: "c1", supports: [], challenges: [p1] },
    ]);
  });
});

describe("selectPapers", () => {
  it("keeps the most relevant papers first, unanalysed last, capped", () => {
    const many: Paper[] = Array.from({ length: MAX_RELATION_PAPERS + 5 }, (_, i) => ({
      ...papers[0]!,
      id: `x${i}`,
    }));
    const scored = new Map<string, PaperAnalysis>(
      many.slice(1).map((p, i) => [p.id, { ...analyses.get(p1!)!, relevance: i }]),
    );
    const picked = selectPapers(many, scored);
    expect(picked).toHaveLength(MAX_RELATION_PAPERS);
    expect(picked[0]!.id).toBe(`x${many.length - 1}`);
    expect(picked.map((p) => p.id)).not.toContain("x0");
  });
});

describe("buildRelationsPrompt", () => {
  it("shows papers as aliases with no bibliographic identifiers", () => {
    const { system, messages, aliases } = buildRelationsPrompt({ topic, claims }, papers, analyses);
    expect([...aliases.entries()][0]).toEqual(["P1", p1]);
    expect(aliases.size).toBe(5);
    const text = JSON.stringify({ system, messages });
    expect(text).toContain("[P5]");
    for (const paper of papers) {
      expect(text).not.toContain(paper.id);
      if (paper.doi) expect(text).not.toContain(paper.doi);
      for (const author of paper.authors) expect(text).not.toContain(author.name);
    }
    expect(text).toContain(analyses.get(p1!)!.methodology);
  });

  it("falls back to a short abstract when a paper has no analysis", () => {
    const paper: Paper = { ...papers[0]!, id: "raw", abstract: Array(300).fill("word").join(" ") };
    const { messages } = buildRelationsPrompt({ topic, claims }, [paper], new Map());
    const content = messages[0]!.content as string;
    expect(content).toContain("Abstract:");
    expect(content.split("word").length - 1).toBeLessThanOrEqual(120);
  });
});

describe("finaliseRelations", () => {
  const aliases = new Map([
    ["P1", "id1"],
    ["P2", "id2"],
    ["P3", "id3"],
  ]);

  it("maps aliases to ids and drops unknown, self, duplicate and too-small entries", () => {
    const output: RelationsOutput = {
      methods: [
        { label: "Longitudinal panel", papers: ["P1", "P2", "P2", "P9"] },
        { label: "Lonely", papers: ["P3", "P7"] },
      ],
      pairs: [
        { a: "P1", b: "P2", kind: "contrast", note: "Opposite findings." },
        { a: "P2", b: "P1", kind: "complement", note: "Duplicate." },
        { a: "P3", b: "P3", kind: "complement", note: "Self." },
        { a: "P1", b: "P8", kind: "complement", note: "Unknown." },
        { a: " p3 ", b: "P1", kind: "complement", note: "Loose alias." },
      ],
    };
    expect(finaliseRelations(output, aliases)).toEqual({
      methods: [{ label: "Longitudinal panel", paperIds: ["id1", "id2"] }],
      pairs: [
        { a: "id1", b: "id2", kind: "contrast", note: "Opposite findings." },
        { a: "id3", b: "id1", kind: "complement", note: "Loose alias." },
      ],
    });
  });
});

describe("analyseRelations", () => {
  beforeEach(() => askJson.mockReset());

  it("asks the smart model and returns ids only", async () => {
    askJson.mockResolvedValueOnce({
      data: {
        methods: [{ label: "Umbrella reviews", papers: ["P2", "P5"] }],
        pairs: [{ a: "P1", b: "P3", kind: "contrast", note: "Different designs." }],
      } satisfies RelationsOutput,
      model: "m",
      repaired: false,
      usage,
    });
    const relations = await analyseRelations({
      projectId: fixtureProject.id,
      topic,
      claims,
      papers,
      analyses,
    });
    expect(projectRelationsSchema.parse(relations)).toEqual(relations);
    expect(relations.paperCount).toBe(5);
    expect(relations.methods).toEqual([{ label: "Umbrella reviews", paperIds: [p2, p5] }]);
    expect(relations.pairs[0]).toMatchObject({ a: p1, b: p3 });
    expect(askJson.mock.calls[0]![0]).toMatchObject({ tier: "smart", cacheSystem: true });
  });

  it("does not call the model for fewer than two papers", async () => {
    const relations = await analyseRelations({
      projectId: fixtureProject.id,
      topic,
      claims,
      papers: papers.slice(0, 1),
      analyses,
    });
    expect(askJson).not.toHaveBeenCalled();
    expect(relations).toMatchObject({ paperCount: 1, methods: [], pairs: [] });
    expect(relations.claims[0]).toEqual({ claimId: "c1", supports: [], challenges: [p1] });
  });
});

describe("relations fixture", () => {
  it("is a valid response over fixture paper ids", () => {
    const relations = projectRelationsSchema.parse(fixtureRelations);
    const known = new Set(fixturePapers.map((f) => f.paper.id));
    const ids = [
      ...relations.claims.flatMap((c) => [...c.supports, ...c.challenges]),
      ...relations.methods.flatMap((m) => m.paperIds),
      ...relations.pairs.flatMap((p) => [p.a, p.b]),
    ];
    for (const id of ids) expect(known.has(id)).toBe(true);
  });
});
