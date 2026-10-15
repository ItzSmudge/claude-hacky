import { describe, expect, it } from "vitest";
import {
  credibilitySchema,
  paperAnalysisSchema,
  paperSchema,
  projectContextSchema,
} from "@/lib/api-schemas";
import { fixturePapers, fixtureProject } from "./index";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("fixtures", () => {
  it("has 20 papers with unique ids", () => {
    expect(fixturePapers).toHaveLength(20);
    expect(new Set(fixturePapers.map((e) => e.paper.id)).size).toBe(20);
  });

  it("match the frozen contracts", () => {
    expect(() => projectContextSchema.parse(fixtureProject.context)).not.toThrow();
    for (const e of fixturePapers) {
      paperSchema.parse(e.paper);
      paperAnalysisSchema.parse(e.analysis);
      credibilitySchema.parse(e.credibility);
    }
  });

  it("analyses respect word limits and reference known papers and claims", () => {
    const claimIds = new Set(fixtureProject.context.claims.map((c) => c.id));
    for (const { paper, analysis } of fixturePapers) {
      expect(analysis.paperId).toBe(paper.id);
      expect(analysis.projectId).toBe(fixtureProject.id);
      expect(words(analysis.overview)).toBeLessThanOrEqual(35);
      expect(words(analysis.whyItMatters)).toBeLessThanOrEqual(20);
      expect(words(analysis.methodology)).toBeLessThanOrEqual(15);
      expect(words(analysis.limitations)).toBeLessThanOrEqual(15);
      for (const s of analysis.stances) expect(claimIds.has(s.claimId)).toBe(true);
    }
  });
});
