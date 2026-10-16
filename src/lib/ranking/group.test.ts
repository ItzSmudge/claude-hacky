import { describe, expect, it } from "vitest";
import {
  applyTeamChange,
  combineWeights,
  keepHead,
  teamDecisionsFrom,
  teamSwipeChange,
} from "./group";
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

describe("teamSwipeChange", () => {
  const ctx = { projectId: "p1", me: "u1" };
  const row = (over: Record<string, unknown> = {}) => ({
    project_id: "p1",
    paper_id: "openalex-W1",
    user_id: "u2",
    decision: "save",
    ...over,
  });

  it("reads a teammate's new swipe", () => {
    expect(teamSwipeChange({ eventType: "INSERT", new: row(), old: {} }, ctx)).toEqual({
      userId: "u2",
      paperId: "openalex-W1",
      decision: "save",
    });
  });

  it("reads a changed mind", () => {
    const change = teamSwipeChange({ eventType: "UPDATE", new: row({ decision: "skip" }) }, ctx);
    expect(change?.decision).toBe("skip");
  });

  it("reads an undo from the primary key alone", () => {
    const old = { project_id: "p1", paper_id: "openalex-W1", user_id: "u2" };
    expect(teamSwipeChange({ eventType: "DELETE", new: {}, old }, ctx)).toEqual({
      userId: "u2",
      paperId: "openalex-W1",
      decision: null,
    });
  });

  it("ignores my own swipes, which the deck already has", () => {
    expect(teamSwipeChange({ eventType: "INSERT", new: row({ user_id: "u1" }) }, ctx)).toBeNull();
  });

  it("ignores other projects, since undo events can't be filtered by the server", () => {
    expect(
      teamSwipeChange({ eventType: "INSERT", new: row({ project_id: "p2" }) }, ctx),
    ).toBeNull();
    const old = { project_id: "p2", paper_id: "openalex-W1", user_id: "u2" };
    expect(teamSwipeChange({ eventType: "DELETE", old }, ctx)).toBeNull();
  });

  it("ignores malformed rows and unknown decisions", () => {
    expect(
      teamSwipeChange({ eventType: "INSERT", new: row({ decision: "maybe" }) }, ctx),
    ).toBeNull();
    expect(teamSwipeChange({ eventType: "INSERT", new: { paper_id: "x" } }, ctx)).toBeNull();
    expect(teamSwipeChange(null, ctx)).toBeNull();
  });
});

describe("applyTeamChange", () => {
  const team = teamDecisionsFrom([
    { userId: "u2", paperId: "a", decision: "skip" },
    { userId: "u2", paperId: "b", decision: "save" },
  ]);

  it("replaces a changed mind in place instead of counting it twice", () => {
    const next = applyTeamChange(team, { userId: "u2", paperId: "a", decision: "save" });
    expect([...next.get("u2")!]).toEqual([
      ["a", "save"],
      ["b", "save"],
    ]);
  });

  it("adds a new teammate", () => {
    const next = applyTeamChange(team, { userId: "u3", paperId: "a", decision: "save" });
    expect([...next.get("u3")!]).toEqual([["a", "save"]]);
  });

  it("removes an undone swipe, and the teammate once they have none", () => {
    let next = applyTeamChange(team, { userId: "u2", paperId: "a", decision: null });
    expect([...next.get("u2")!.keys()]).toEqual(["b"]);
    next = applyTeamChange(next, { userId: "u2", paperId: "b", decision: null });
    expect(next.has("u2")).toBe(false);
  });

  it("doesn't change the map it was given", () => {
    applyTeamChange(team, { userId: "u2", paperId: "a", decision: null });
    expect(team.get("u2")?.get("a")).toBe("skip");
  });
});
