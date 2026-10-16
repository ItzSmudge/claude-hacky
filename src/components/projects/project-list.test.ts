import { describe, expect, it } from "vitest";
import { summariseSwipes, toProject } from "./project-list";

const row = (project_id: string, paper_id: string, user_id: string, decision: string) => ({
  project_id,
  paper_id,
  user_id,
  decision,
});

describe("summariseSwipes", () => {
  it("counts distinct saved papers across members and the caller's own swipes", () => {
    const counts = summariseSwipes(
      [
        row("p1", "a", "me", "save"),
        row("p1", "a", "mate", "save"), // same paper saved twice → counts once
        row("p1", "b", "me", "skip"),
        row("p1", "c", "mate", "save"),
        row("p2", "a", "mate", "skip"),
      ],
      "me",
    );
    expect(counts.get("p1")).toEqual({ savedCount: 2, swipeCount: 2 });
    expect(counts.get("p2")).toEqual({ savedCount: 0, swipeCount: 0 });
  });

  it("returns nothing for projects without swipes", () => {
    expect(summariseSwipes([], "me").get("p1")).toBeUndefined();
  });
});

describe("toProject", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000001",
    owner_id: "00000000-0000-4000-8000-0000000000d0",
    title: "Teens",
    query: "social media",
    join_code: "DEMO42",
    created_at: "2026-10-15T00:00:00Z",
  };

  it("maps a row to the API shape and keeps a valid context", () => {
    const context = {
      topic: "t",
      claims: [{ id: "c1", text: "x" }],
      themes: [],
      constraints: [],
      summary: "s",
    };
    expect(toProject({ ...base, context })).toEqual({
      id: base.id,
      ownerId: base.owner_id,
      title: "Teens",
      query: "social media",
      context,
      joinCode: "DEMO42",
      createdAt: base.created_at,
    });
  });

  it("drops a malformed context to null", () => {
    expect(toProject({ ...base, context: { topic: 3 } }).context).toBeNull();
    expect(toProject({ ...base, context: null }).context).toBeNull();
  });
});
