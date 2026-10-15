import { describe, expect, it } from "vitest";
import { fixturePapers } from "@/fixtures";
import { extractFeatures } from "./features";
import { featureIdf, learnWeights, rankItems, scorePaper, type SwipeSample } from "./weights";

const save = (...features: string[]): SwipeSample => ({ features, decision: "save" });
const skip = (...features: string[]): SwipeSample => ({ features, decision: "skip" });

describe("learnWeights", () => {
  it("adds for saves and subtracts for skips", () => {
    const w = learnWeights([save("a"), skip("b")]);
    expect(w.get("a")).toBeGreaterThan(0);
    expect(w.get("b")).toBeLessThan(0);
  });

  it("normalises by 1/√n so feature-heavy papers don't count more", () => {
    const w = learnWeights([save("a", "b", "c", "d")], { decay: 1 });
    expect(w.get("a")).toBeCloseTo(0.5);
  });

  it("decays older swipes so recent taste wins", () => {
    const w = learnWeights([skip("a"), save("a")], { decay: 0.5 });
    expect(w.get("a")).toBeCloseTo(0.5); // -1 * 0.5 + 1
  });

  it("is a pure fold: undo equals the shorter history", () => {
    const history = [save("a"), skip("b"), save("c")];
    expect(learnWeights(history.slice(0, -1))).toEqual(learnWeights(history.slice(0, 2)));
  });

  it("returns no weights for no history", () => {
    expect(learnWeights([]).size).toBe(0);
  });
});

describe("featureIdf", () => {
  it("gives universal features zero weight and rare features more", () => {
    const idf = featureIdf([
      ["common", "rare"],
      ["common", "mid"],
      ["common", "mid"],
    ]);
    expect(idf.get("common")).toBeCloseTo(0);
    expect(idf.get("rare")!).toBeGreaterThan(idf.get("mid")!);
  });

  it("counts a feature once per paper", () => {
    expect(featureIdf([["a", "a"], ["b"]]).get("a")).toBeCloseTo(Math.log(3 / 2));
  });
});

describe("scorePaper", () => {
  it("sums weight × idf, ignoring unknown features", () => {
    const weights = new Map([
      ["a", 2],
      ["b", -1],
    ]);
    const idf = new Map([
      ["a", 0.5],
      ["b", 1],
    ]);
    expect(scorePaper(["a", "b", "zzz"], weights, idf)).toBeCloseTo(0);
    expect(scorePaper([], weights, idf)).toBe(0);
  });
});

describe("rankItems", () => {
  type Item = { id: string; f: string[] };
  const item = (id: string, ...f: string[]): Item => ({ id, f });
  const featuresOf = (i: Item) => i.f;
  const items = [item("x1", "x"), item("y1", "y"), item("x2", "x"), item("y2", "y")];
  const likesY = [save("y"), save("y"), skip("x"), skip("x"), save("y"), skip("x")];

  it("returns the same array below the swipe threshold", () => {
    expect(rankItems(items, featuresOf, likesY.slice(0, 5))).toBe(items);
  });

  it("re-ranks from the 6th swipe on", () => {
    expect(rankItems(items, featuresOf, likesY).map((i) => i.id)).toEqual(["y1", "y2", "x1", "x2"]);
  });

  it("respects a custom threshold", () => {
    expect(rankItems(items, featuresOf, likesY.slice(0, 2), { minSwipes: 2 })[0]?.id).toBe("y1");
  });

  it("keeps the original order on ties and for featureless items", () => {
    const flat = [item("a"), item("b"), item("c")];
    expect(rankItems(flat, featuresOf, likesY).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("ignores features every paper shares", () => {
    const shared = [item("a", "s", "x"), item("b", "s", "y")];
    const history = [save("s"), save("s"), save("s"), save("s"), save("s"), save("y")];
    expect(rankItems(shared, featuresOf, history).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("puts reviews first after saving reviews and skipping longitudinal studies (fixtures)", () => {
    const now = new Date("2026-10-15");
    const deck = fixturePapers.map((e) => ({
      id: e.paper.id,
      f: extractFeatures(e.paper, { credibility: e.credibility, now }).map((x) => x.id),
    }));
    const reviews = deck.filter((d) => d.f.includes("study:review"));
    const longitudinal = deck.filter((d) => d.f.includes("study:longitudinal"));
    expect(reviews.length).toBeGreaterThanOrEqual(3);
    expect(longitudinal.length).toBeGreaterThanOrEqual(3);

    const swiped = [...reviews.slice(0, 3), ...longitudinal.slice(0, 3)];
    const history = [
      ...reviews.slice(0, 3).map((d) => save(...d.f)),
      ...longitudinal.slice(0, 3).map((d) => skip(...d.f)),
    ];
    const upcoming = deck.filter((d) => !swiped.includes(d));
    const ranked = rankItems(upcoming, featuresOf, history);
    expect(ranked[0]?.f).toContain("study:review");
    // Every remaining review ranks above every remaining longitudinal study.
    const pos = (kind: string) =>
      ranked.flatMap((d, i) =>
        d.f.includes(kind) &&
        !d.f.includes(kind === "study:review" ? "study:longitudinal" : "study:review")
          ? [i]
          : [],
      );
    const lastReview = Math.max(-1, ...pos("study:review"));
    const firstLongitudinal = Math.min(ranked.length, ...pos("study:longitudinal"));
    expect(lastReview).toBeLessThan(firstLongitudinal);
  });
});
