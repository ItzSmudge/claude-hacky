import { describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { projectRelationsSchema } from "./schemas";

vi.mock("server-only", () => ({}));

// Opt-in real API call (costs tokens). Run:
//   AI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/relations.live.test.ts
const live = process.env.AI_LIVE === "1";

describe.skipIf(!live)("analyseRelations (live)", () => {
  it("relates the fixture papers by id only", async () => {
    const { analyseRelations } = await import("./relations");
    const saved = fixturePapers.slice(0, 10);
    const relations = await analyseRelations({
      projectId: fixtureProject.id,
      topic: fixtureProject.context.topic,
      claims: fixtureProject.context.claims,
      papers: saved.map((f) => f.paper),
      analyses: new Map(saved.map((f) => [f.paper.id, f.analysis])),
    });
    console.log(JSON.stringify(relations, null, 1));
    expect(projectRelationsSchema.parse(relations)).toEqual(relations);
    expect(relations.methods.length + relations.pairs.length).toBeGreaterThan(0);
    const known = new Set(saved.map((f) => f.paper.id));
    for (const id of [
      ...relations.methods.flatMap((m) => m.paperIds),
      ...relations.pairs.flatMap((p) => [p.a, p.b]),
    ])
      expect(known.has(id)).toBe(true);
    const text = JSON.stringify(relations);
    expect(text).not.toMatch(/https?:\/\/|\b10\.\d{4,9}\//);
    for (const { paper } of saved) expect(text).not.toContain(paper.title);
  }, 180_000);
});
