import { describe, expect, it } from "vitest";
import type { PaperAnalysis, Stance } from "@/types/domain";
import { groupByClaim, groupByUse, type LibraryItem } from "./library-groups";

const claims = [
  { id: "c1", text: "Heavy use harms wellbeing" },
  { id: "c2", text: "Effects are small" },
];

const item = (
  id: string,
  score: number,
  analysis?: Partial<PaperAnalysis> & { stanceFor?: Record<string, Stance> },
): LibraryItem => ({
  paper: { id, source: "openalex", externalId: id, title: `Title ${id}`, authors: [], topics: [] },
  credibility: { score, inputs: {} },
  citeKey: `key${id}`,
  savedByMe: true,
  savedByTeammate: false,
  analysis: analysis && {
    paperId: id,
    projectId: "p",
    overview: "",
    whyItMatters: "",
    relevance: 50,
    relevanceReason: "",
    methodology: "",
    limitations: "",
    useAs: "evidence",
    stances: Object.entries(analysis.stanceFor ?? {}).map(([claimId, stance]) => ({
      claimId,
      stance,
      note: "",
    })),
    ...analysis,
  },
});

describe("groupByUse", () => {
  it("orders sections evidence, counterpoint, method, background, unanalysed and skips empty ones", () => {
    const groups = groupByUse([
      item("a", 50, { useAs: "background" }),
      item("b", 50),
      item("c", 50, { useAs: "evidence" }),
      item("d", 50, { useAs: "method" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["evidence", "method", "background", "unanalysed"]);
  });

  it("sorts each section by credibility, then title", () => {
    const [evidence] = groupByUse([
      item("b", 60, { useAs: "evidence" }),
      item("a", 60, { useAs: "evidence" }),
      item("c", 90, { useAs: "evidence" }),
    ]);
    expect(evidence!.items.map((i) => i.paper.id)).toEqual(["c", "a", "b"]);
  });

  it("returns nothing for an empty library", () => {
    expect(groupByUse([])).toEqual([]);
  });
});

describe("groupByClaim", () => {
  it("lists supporters and challengers per claim and counts the rest", () => {
    const groups = groupByClaim(
      [
        item("a", 80, { stanceFor: { c1: "supports", c2: "neutral" } }),
        item("b", 70, { stanceFor: { c1: "challenges", c2: "supports" } }),
        item("c", 90, { stanceFor: { c1: "supports" } }),
        item("d", 60),
      ],
      claims,
    );
    expect(groups).toEqual([
      {
        claim: { id: "c1", text: "Heavy use harms wellbeing", label: "Claim 1" },
        supports: [
          expect.objectContaining({ citeKey: "keyc" }),
          expect.objectContaining({ citeKey: "keya" }),
        ],
        challenges: [expect.objectContaining({ citeKey: "keyb" })],
        otherCount: 0,
      },
      {
        claim: { id: "c2", text: "Effects are small", label: "Claim 2" },
        supports: [expect.objectContaining({ citeKey: "keyb" })],
        challenges: [],
        otherCount: 1,
      },
    ]);
  });

  it("ignores stances for unknown claims and uses the first stance per claim", () => {
    const [c1] = groupByClaim(
      [
        {
          ...item("a", 50, { stanceFor: { c1: "supports" } }),
          analysis: {
            ...item("a", 50, { stanceFor: {} }).analysis!,
            stances: [
              { claimId: "zz", stance: "supports", note: "" },
              { claimId: "c1", stance: "challenges", note: "" },
              { claimId: "c1", stance: "supports", note: "" },
            ],
          },
        },
      ],
      claims,
    );
    expect(c1!.challenges).toHaveLength(1);
    expect(c1!.supports).toHaveLength(0);
  });

  it("returns nothing without claims", () => {
    expect(groupByClaim([item("a", 50, { stanceFor: { c1: "supports" } })], [])).toEqual([]);
  });
});
