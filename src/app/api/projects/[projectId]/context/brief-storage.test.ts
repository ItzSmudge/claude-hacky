import { describe, expect, it, vi } from "vitest";
import { fixtureProject } from "@/fixtures";

vi.mock("server-only", () => ({}));
const { AiConfigError, AiOutputError, AiRefusalError, BriefInputError } =
  await import("@/lib/ai/errors");
const { briefStoragePath, contextErrorStatus } = await import("./brief-storage");

const PID = fixtureProject.id;

describe("briefStoragePath", () => {
  it("prefixes the project and random id", () => {
    expect(briefStoragePath(PID, "brief.docx", "r4nd")).toBe(`${PID}/r4nd-brief.docx`);
  });

  it("makes hostile names safe", () => {
    const path = briefStoragePath(PID, "../Brief (final) é.docx", "r");
    expect(path.startsWith(`${PID}/r-`)).toBe(true);
    expect(path.slice(PID.length + 1)).toMatch(/^[a-z0-9._-]+$/);
    expect(path).not.toContain("..");
    expect(path.endsWith(".docx")).toBe(true);
  });

  it("caps very long names and keeps the extension", () => {
    const path = briefStoragePath(PID, `${"a".repeat(300)}.pdf`, "r");
    expect(path.length).toBeLessThanOrEqual(PID.length + 1 + 100);
    expect(path.endsWith(".pdf")).toBe(true);
  });

  it("falls back to a name when nothing safe is left", () => {
    expect(briefStoragePath(PID, "简报.pdf", "r")).toBe(`${PID}/r-brief.pdf`);
  });
});

describe("contextErrorStatus", () => {
  it("maps BriefInputError to 400 with its message", () => {
    expect(contextErrorStatus(new BriefInputError("unreadable", "Nope."))).toEqual({
      status: 400,
      message: "Nope.",
    });
  });

  it("maps AiConfigError to 503", () => {
    expect(contextErrorStatus(new AiConfigError("x")).status).toBe(503);
  });

  it.each([
    ["AiOutputError", new AiOutputError("invalid")],
    ["AiRefusalError", new AiRefusalError(null, null)],
    ["a plain Error", new Error("boom")],
  ])("maps %s to 502 with the spec's copy", (_, error) => {
    expect(contextErrorStatus(error)).toEqual({
      status: 502,
      message: "Couldn't read that right now.",
    });
  });
});
