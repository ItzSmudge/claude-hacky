import { describe, expect, it } from "vitest";
import { fixtureProject } from "@/fixtures";
import { projectContextSchema } from "@/lib/api-schemas";
import {
  checkBriefFile,
  contextFromDraft,
  draftFromContext,
  failureKind,
  MAX_CLAIMS,
  MAX_UPLOAD_BYTES,
  titleFromQuestion,
  TOO_LARGE_MESSAGE,
} from "./new-project";

describe("titleFromQuestion", () => {
  it("keeps a short question, tidied", () => {
    expect(titleFromQuestion("  Does sleep   matter? ")).toBe("Does sleep matter?");
  });

  it("cuts long questions at a word boundary within 80 characters", () => {
    const title = titleFromQuestion("word ".repeat(40));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
    expect(
      title
        .slice(0, -1)
        .split(" ")
        .every((w) => w === "word"),
    ).toBe(true);
  });

  it("hard-cuts a single word longer than 80", () => {
    expect(titleFromQuestion("x".repeat(120)).length).toBeLessThanOrEqual(80);
  });
});

describe("checkBriefFile", () => {
  it.each(["brief.pdf", "Brief.DOCX", "notes.md", "a.txt"])("accepts %s", (name) => {
    expect(checkBriefFile({ name, size: 1000 })).toBeNull();
  });

  it("rejects files over 4 MB with the spec's copy", () => {
    expect(checkBriefFile({ name: "b.pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe(TOO_LARGE_MESSAGE);
    expect(TOO_LARGE_MESSAGE).toBe("Briefs can be up to 4 MB. Try the Word or text version.");
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });

  it.each(["scan.png", "brief.doc", "brief"])("rejects %s", (name) => {
    expect(checkBriefFile({ name, size: 10 })).toMatch(/PDF, Word \(\.docx\) or text/);
  });
});

describe("draft ↔ context", () => {
  const context = fixtureProject.context;

  it("round-trips the fixture context", () => {
    expect(contextFromDraft(draftFromContext(context))).toEqual(context);
  });

  it("drops empty claims and renumbers ids in order", () => {
    const draft = { ...draftFromContext(context), claims: ["B", "  ", "A"] };
    expect(contextFromDraft(draft).claims).toEqual([
      { id: "c1", text: "B" },
      { id: "c2", text: "A" },
    ]);
  });

  it("keeps at most MAX_CLAIMS claims", () => {
    const draft = { ...draftFromContext(context), claims: Array<string>(8).fill("x") };
    expect(contextFromDraft(draft).claims).toHaveLength(MAX_CLAIMS);
  });

  it("drops empty themes and constraints and trims the topic", () => {
    const draft = {
      ...draftFromContext(context),
      topic: "  Sleep  ",
      themes: ["", "sleep"],
      constraints: [" "],
    };
    expect(contextFromDraft(draft)).toMatchObject({
      topic: "Sleep",
      themes: ["sleep"],
      constraints: [],
    });
  });

  it("does not share arrays with the context it came from", () => {
    const draft = draftFromContext(context);
    draft.themes.push("new");
    expect(context.themes).not.toContain("new");
  });

  it("passes projectContextSchema", () => {
    const result = projectContextSchema.safeParse(contextFromDraft(draftFromContext(context)));
    expect(result.success).toBe(true);
  });
});

describe("failureKind", () => {
  it("treats 400 as a file problem", () => {
    expect(failureKind(400)).toBe("file");
  });

  it.each([401, 500, 502, 503, 504])("treats %i as an AI problem", (status) => {
    expect(failureKind(status)).toBe("ai");
  });
});
