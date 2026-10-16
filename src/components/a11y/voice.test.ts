import { describe, expect, it } from "vitest";
import { matchCommand } from "./voice";

describe("matchCommand", () => {
  it.each([
    ["save", "save"],
    ["Save it", "save"],
    ["skip", "skip"],
    ["skip this", "skip"],
    ["undo", "undo"],
    ["go back", "undo"],
    ["read", "read"],
    ["read it out", "read"],
    ["listen", "read"],
    ["why", "why"],
    ["why does it matter", "why"],
    ["details", "details"],
    ["show details", "details"],
    ["stop", "stop"],
    ["stop reading", "stop"],
  ])("%j → %s", (heard, command) => {
    expect(matchCommand(heard)).toBe(command);
  });

  it("ignores case, punctuation and filler words", () => {
    expect(matchCommand("  SAVE! ")).toBe("save");
    expect(matchCommand("um, save it please")).toBe("save");
    expect(matchCommand("okay skip the paper")).toBe("skip");
  });

  it("only acts when the whole utterance is a command", () => {
    expect(matchCommand("I'd save that one")).toBeNull();
    expect(matchCommand("no, I'd keep it")).toBeNull();
    expect(matchCommand("there's no more time")).toBeNull();
    expect(matchCommand("why is that")).toBeNull();
    expect(matchCommand("Saved. 18 left. Next: social media use")).toBeNull();
  });

  it("ignores everyday single words and near misses", () => {
    for (const word of ["yes", "no", "next", "more", "back", "keep", "pass", "saved", "skipping"]) {
      expect(matchCommand(word)).toBeNull();
    }
    expect(matchCommand("")).toBeNull();
    expect(matchCommand("um")).toBeNull();
  });
});
