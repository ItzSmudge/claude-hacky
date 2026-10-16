import { describe, expect, it } from "vitest";
import { applyVote, memberLabels, summariseGroup, type Vote } from "./group-list";

const v = (paperId: string, userId: string, decision: "save" | "skip"): Vote => ({
  paperId,
  userId,
  decision,
});

describe("summariseGroup", () => {
  const votes = [
    v("a", "me", "save"),
    v("a", "u2", "save"),
    v("a", "u3", "save"),
    v("b", "me", "save"),
    v("b", "u2", "skip"),
    v("c", "u2", "save"),
    v("d", "u2", "skip"),
    v("d", "u3", "skip"),
  ];

  it("splits papers into to-discuss (saved and skipped) and agreed picks", () => {
    const { discuss, picks } = summariseGroup(votes, "me");
    expect(discuss.map((p) => p.paperId)).toEqual(["b"]);
    expect(picks.map((p) => p.paperId)).toEqual(["a", "c"]);
  });

  it("leaves out papers nobody saved", () => {
    const { discuss, picks } = summariseGroup(votes, "me");
    expect([...discuss, ...picks].some((p) => p.paperId === "d")).toBe(false);
  });

  it("counts saves and skips and records my vote", () => {
    const { discuss, picks } = summariseGroup(votes, "me");
    expect(discuss[0]).toMatchObject({ saves: 1, skips: 1, myVote: "save" });
    expect(picks[0]).toMatchObject({ paperId: "a", saves: 3, skips: 0, myVote: "save" });
    expect(picks[1]).toMatchObject({ paperId: "c", saves: 1, myVote: undefined });
  });

  it("orders by saves, most first, then by paper id for a stable order", () => {
    const { picks } = summariseGroup(
      [v("z", "u1", "save"), v("y", "u1", "save"), v("x", "u1", "save"), v("x", "u2", "save")],
      "me",
    );
    expect(picks.map((p) => p.paperId)).toEqual(["x", "y", "z"]);
  });

  it("lists voters with savers first", () => {
    const { discuss } = summariseGroup([v("b", "u2", "skip"), v("b", "me", "save")], "me");
    expect(discuss[0].voters).toEqual([
      { userId: "me", decision: "save" },
      { userId: "u2", decision: "skip" },
    ]);
  });

  it("returns empty lists for no votes", () => {
    expect(summariseGroup([], "me")).toEqual({ discuss: [], picks: [] });
  });
});

describe("applyVote", () => {
  it("replaces my vote and leaves others alone", () => {
    const next = applyVote([v("b", "me", "save"), v("b", "u2", "skip")], "b", "me", "skip");
    expect(next).toEqual([v("b", "u2", "skip"), v("b", "me", "skip")]);
  });

  it("adds a vote when I hadn't voted", () => {
    expect(applyVote([v("c", "u2", "save")], "c", "me", "save")).toEqual([
      v("c", "u2", "save"),
      v("c", "me", "save"),
    ]);
  });

  it("resolves a split once everyone agrees", () => {
    const next = applyVote([v("b", "me", "skip"), v("b", "u2", "save")], "b", "me", "save");
    const { discuss, picks } = summariseGroup(next, "me");
    expect(discuss).toEqual([]);
    expect(picks[0]).toMatchObject({ paperId: "b", saves: 2, skips: 0 });
  });
});

describe("memberLabels", () => {
  it("calls me You, uses display names, and numbers the rest in join order", () => {
    const labels = memberLabels(
      [
        { userId: "owner", displayName: null },
        { userId: "me", displayName: "Sam" },
        { userId: "u3", displayName: "  Priya " },
        { userId: "u4", displayName: "" },
      ],
      "me",
    );
    expect(labels.get("owner")).toBe("Member 1");
    expect(labels.get("me")).toBe("You");
    expect(labels.get("u3")).toBe("Priya");
    expect(labels.get("u4")).toBe("Member 4");
  });
});
