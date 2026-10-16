import { describe, expect, it } from "vitest";
import { combineWeights, keepHead } from "./group";
import { learnWeights, rankItems, type SwipeSample } from "./weights";

const save = (...features: string[]): SwipeSample => ({ features, decision: "save" });
const skip = (...features: string[]): SwipeSample => ({ features, decision: "skip" });

describe("combineWeights", () => {
  it("is just my weights when nobody else has swiped", () => {
    const own = [save("a"), skip("b")];
    expect(combineWeights(own, [])).toEqual(learnWeights(own));
  });

  it("counts a teammate's swipes at half strength", () => {
    expect(combineWeights([], [[save("x")]]).get("x")).toBeCloseTo(0.5);
  });

  it("averages teammates, so they cancel out or agree without piling up", () => {
    expect(combineWeights([], [[save("x")], [skip("x")]]).get("x")).toBeCloseTo(0);
    expect(combineWeights([], [[save("x")], [save("x")]]).get("x")).toBeCloseTo(0.5);
  });

  it("adds teammates on top of my own taste", () => {
    expect(combineWeights([save("x")], [[save("x")]]).get("x")).toBeCloseTo(1.5);
  });

  it("ignores teammates with no swipes in the average", () => {
    expect(combineWeights([], [[save("x")], []]).get("x")).toBeCloseTo(0.5);
  });
});

describe("rankItems with teammates", () => {
  const items = [
    { id: "plain", f: ["y"] },
    { id: "liked", f: ["x"] },
  ];
  const featuresOf = (i: (typeof items)[number]) => i.f;
  const team = [Array.from({ length: 6 }, () => save("x"))];

  it("ranks by the group's swipes before I've swiped at all", () => {
    const ranked = rankItems(items, featuresOf, [], { teamHistories: team });
    expect(ranked.map((i) => i.id)).toEqual(["liked", "plain"]);
  });

  it("leaves the order alone with no swipes from anyone", () => {
    expect(rankItems(items, featuresOf, [], { teamHistories: [] })).toBe(items);
  });

  it("is unchanged from solo ranking when there are no teammates", () => {
    const own = [...Array.from({ length: 5 }, () => save("y")), skip("x")];
    expect(rankItems(items, featuresOf, own, { teamHistories: [] })).toEqual(
      rankItems(items, featuresOf, own),
    );
  });
});

describe("keepHead", () => {
  it("keeps the first cards where they were and reorders the rest", () => {
    expect(keepHead(["a", "b", "c", "d"], ["d", "c", "b", "a"])).toEqual(["a", "b", "d", "c"]);
  });

  it("drops a pinned card that's no longer in the deck", () => {
    expect(keepHead(["a", "b", "c"], ["c", "a"])).toEqual(["a", "c"]);
  });

  it("takes the new order when there was nothing before", () => {
    expect(keepHead([], ["b", "a"])).toEqual(["b", "a"]);
  });

  it("matches cards by key", () => {
    const prev = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const next = [{ id: "c" }, { id: "b" }, { id: "a" }];
    expect(keepHead(prev, next, 1, (i) => i.id).map((i) => i.id)).toEqual(["a", "c", "b"]);
  });
});
