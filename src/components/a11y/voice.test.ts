import { describe, expect, it } from "vitest";
import { matchCommand } from "./voice";

describe("matchCommand", () => {
  it.each([
    ["save", "save"],
    ["Save it", "save"],
    ["keep", "save"],
    ["skip", "skip"],
    ["next one", "skip"],
    ["pass", "skip"],
    ["undo", "undo"],
    ["go back", "undo"],
    ["read", "read"],
    ["read it out", "read"],
    ["why does it matter", "why"],
    ["why", "why"],
    ["details", "details"],
    ["show more", "details"],
    ["stop", "stop"],
    ["be quiet", "stop"],
  ])("%j → %s", (heard, command) => {
    expect(matchCommand(heard)).toBe(command);
  });

  it("ignores case and punctuation", () => {
    expect(matchCommand("  SAVE! ")).toBe("save");
  });

  it("uses the last command in a run-on phrase", () => {
    expect(matchCommand("um skip no wait save")).toBe("save");
  });

  it("doesn't fire on words that merely contain a command", () => {
    expect(matchCommand("saved paper")).toBeNull();
    expect(matchCommand("skipping")).toBeNull();
    expect(matchCommand("hello there")).toBeNull();
    expect(matchCommand("")).toBeNull();
  });

  it("prefers 'why does it matter' over the 'read' in nothing else", () => {
    expect(matchCommand("read why it matters")).toBe("why");
  });
});
