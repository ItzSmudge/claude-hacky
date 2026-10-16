import { describe, expect, it } from "vitest";
import {
  arrivalMessage,
  decisionMessage,
  nothingLeftMessage,
  spokenTitle,
  undoMessage,
} from "./deck-announcements";

describe("spokenTitle", () => {
  it("trims and collapses whitespace", () => {
    expect(spokenTitle("  Sleep and\n  memory ")).toBe("Sleep and memory");
  });

  it("names a blank or missing title", () => {
    expect(spokenTitle("   ")).toBe("Untitled paper");
    expect(spokenTitle(undefined)).toBe("Untitled paper");
  });

  it("cuts long titles at a word boundary", () => {
    const long = `${"word ".repeat(40)}end`;
    const spoken = spokenTitle(long);
    expect(spoken.length).toBeLessThanOrEqual(101);
    expect(spoken.endsWith("word…")).toBe(true);
  });

  it("drops trailing punctuation so sentences don't double up", () => {
    expect(spokenTitle("Does sleep help?")).toBe("Does sleep help?");
    expect(spokenTitle("A study.")).toBe("A study");
  });
});

describe("decisionMessage", () => {
  it("says what happened, what is next and how many are left", () => {
    expect(decisionMessage({ decision: "save", title: "A", next: "B", left: 4 })).toBe(
      "Saved: A. Next: B. 4 left.",
    );
    expect(decisionMessage({ decision: "skip", title: "A", next: "B", left: 1 })).toBe(
      "Skipped: A. Next: B. 1 left.",
    );
  });

  it("says when that was the last paper", () => {
    expect(decisionMessage({ decision: "save", title: "A", next: null, left: 0 })).toBe(
      "Saved: A. That was the last paper.",
    );
  });

  it("says when more papers are loading instead", () => {
    expect(
      decisionMessage({ decision: "skip", title: "A", next: null, left: 0, loading: true }),
    ).toBe("Skipped: A. Loading more papers.");
  });

  it("does not repeat a sentence-ending mark from the title", () => {
    expect(decisionMessage({ decision: "save", title: "Why?", next: "B.", left: 2 })).toBe(
      "Saved: Why? Next: B. 2 left.",
    );
  });
});

describe("undoMessage", () => {
  it("names the restored paper and the count", () => {
    expect(undoMessage({ title: "A", left: 5 })).toBe("Restored: A. 5 left.");
  });
});

describe("arrivalMessage", () => {
  it("introduces the first paper", () => {
    expect(arrivalMessage({ title: "A", first: true })).toBe("Papers ready. First: A.");
  });

  it("introduces more papers after the deck ran out", () => {
    expect(arrivalMessage({ title: "A", first: false })).toBe("More papers ready. Next: A.");
  });
});

describe("nothingLeftMessage", () => {
  it("differs before and after any papers were shown", () => {
    expect(nothingLeftMessage(0)).toBe("No papers to swipe yet.");
    expect(nothingLeftMessage(3)).toBe("No more papers found.");
  });
});
