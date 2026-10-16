import { describe, expect, it } from "vitest";
import { feedSummary, feedText, presenceText, teammateSave } from "./live";

describe("presenceText", () => {
  it("says nothing when you're alone", () => {
    expect(presenceText([], "me")).toBeNull();
    expect(presenceText(["me"], "me")).toBeNull();
  });

  it("counts you plus everyone else once", () => {
    expect(presenceText(["me", "a", "b"], "me")).toEqual({
      short: "3 swiping",
      long: "You and 2 others are swiping now",
    });
  });

  it("uses the singular for one other person", () => {
    expect(presenceText(["a", "me"], "me")?.long).toBe("You and 1 other are swiping now");
  });

  it("ignores duplicate keys (same person in two tabs)", () => {
    expect(presenceText(["me", "a", "a"], "me")?.short).toBe("2 swiping");
  });

  it("still counts others before your own presence has synced", () => {
    expect(presenceText(["a"], "me")?.short).toBe("2 swiping");
  });
});

describe("teammateSave", () => {
  const row = { project_id: "p", paper_id: "x", user_id: "a", decision: "save" };

  it("returns the paper and saver for someone else's save", () => {
    expect(teammateSave(row, "me")).toEqual({ paperId: "x", userId: "a" });
  });

  it("ignores my own swipes, skips and malformed rows", () => {
    expect(teammateSave({ ...row, user_id: "me" }, "me")).toBeNull();
    expect(teammateSave({ ...row, decision: "skip" }, "me")).toBeNull();
    expect(teammateSave({ paper_id: "x" }, "me")).toBeNull();
    expect(teammateSave(null, "me")).toBeNull();
  });
});

describe("feedText", () => {
  it("names who saved what", () => {
    expect(feedText("Priya", "Short title")).toBe("Priya saved “Short title”");
  });

  it("shortens long titles on a word boundary", () => {
    const text = feedText(
      "Member 2",
      "Social media use and its impact on adolescent mental health",
    );
    expect(text).toBe("Member 2 saved “Social media use and its impact on adolescent…”");
  });

  it("falls back when the title is unknown", () => {
    expect(feedText("Member 2", undefined)).toBe("Member 2 saved a paper");
  });
});

describe("feedSummary", () => {
  const item = (userId: string, label: string, title?: string) => ({ userId, label, title });

  it("is the single save's line for one item", () => {
    expect(feedSummary([item("a", "Priya", "Title")])).toBe("Priya saved “Title”");
  });

  it("counts papers for one person", () => {
    expect(feedSummary([item("a", "Priya"), item("a", "Priya"), item("a", "Priya")])).toBe(
      "Priya saved 3 papers",
    );
  });

  it("names the first person and counts the others", () => {
    expect(feedSummary([item("a", "Priya"), item("b", "Member 3"), item("a", "Priya")])).toBe(
      "Priya and 1 other saved 3 papers",
    );
    expect(feedSummary([item("a", "Priya"), item("b", "Member 3"), item("c", "Member 4")])).toBe(
      "Priya and 2 others saved 3 papers",
    );
  });
});
