import { describe, expect, it } from "vitest";
import {
  canUndo,
  createDeck,
  current,
  deckReducer,
  lastDecision,
  remaining,
  upcoming,
  type DeckState,
} from "./deck-state";

type Item = { paper: { id: string } };
const item = (id: string): Item => ({ paper: { id } });
const items = (...ids: string[]) => ids.map(item);
const ids = (xs: Item[]) => xs.map((x) => x.paper.id);
const id = (x: Item | null) => x?.paper.id ?? null;

const decide = (s: DeckState<Item>, decision: "save" | "skip") =>
  deckReducer(s, { type: "decide", paperId: s.order[s.cursor] ?? "", decision });
const undo = (s: DeckState<Item>) => deckReducer(s, { type: "undo" });

describe("createDeck", () => {
  it("starts at the first item with nothing to undo", () => {
    const s = createDeck(items("a", "b", "c"));
    expect(id(current(s))).toBe("a");
    expect(ids(upcoming(s, 2))).toEqual(["b", "c"]);
    expect(remaining(s)).toBe(3);
    expect(canUndo(s)).toBe(false);
  });

  it("drops duplicate ids, keeping the first", () => {
    const s = createDeck(items("a", "b", "a"));
    expect(s.order).toEqual(["a", "b"]);
  });

  it("handles an empty list", () => {
    const s = createDeck<Item>([]);
    expect(current(s)).toBeNull();
    expect(remaining(s)).toBe(0);
  });
});

describe("decide", () => {
  it("records the decision and advances", () => {
    const s = decide(createDeck(items("a", "b")), "save");
    expect(id(current(s))).toBe("b");
    expect(lastDecision(s)).toEqual({ paperId: "a", decision: "save" });
    expect(remaining(s)).toBe(1);
    expect(canUndo(s)).toBe(true);
  });

  it("is a no-op when paperId is no longer the top card", () => {
    const s = createDeck(items("a", "b"));
    const next = deckReducer(s, { type: "decide", paperId: "b", decision: "save" });
    expect(next).toBe(s);
  });

  it("is a no-op when the deck is empty", () => {
    const s = decide(decide(createDeck(items("a")), "skip"), "save");
    expect(s.history).toEqual([{ paperId: "a", decision: "skip" }]);
    expect(current(s)).toBeNull();
  });
});

describe("undo", () => {
  it("steps back through the full history in reverse order", () => {
    let s = decide(decide(createDeck(items("a", "b", "c")), "save"), "skip");
    s = undo(s);
    expect(id(current(s))).toBe("b");
    expect(lastDecision(s)).toEqual({ paperId: "a", decision: "save" });
    s = undo(s);
    expect(id(current(s))).toBe("a");
    expect(canUndo(s)).toBe(false);
  });

  it("is a no-op with no history", () => {
    const s = createDeck(items("a"));
    expect(undo(s)).toBe(s);
  });

  it("works from the empty state", () => {
    const s = undo(decide(createDeck(items("a")), "save"));
    expect(id(current(s))).toBe("a");
  });
});

describe("replaceUpcoming", () => {
  const sync = (s: DeckState<Item>, ...next: string[]) =>
    deckReducer(s, { type: "replaceUpcoming", items: items(...next) });

  it("re-orders only upcoming cards and keeps the current one on top", () => {
    const s = sync(decide(createDeck(items("a", "b", "c", "d")), "save"), "d", "c", "b");
    expect(id(current(s))).toBe("b");
    expect(ids(upcoming(s, 2))).toEqual(["d", "c"]);
    expect(s.history).toEqual([{ paperId: "a", decision: "save" }]);
  });

  it("never brings back a decided paper", () => {
    const s = sync(decide(createDeck(items("a", "b")), "skip"), "a", "b", "c");
    expect(s.order).toEqual(["a", "b", "c"]);
    expect(id(current(s))).toBe("b");
  });

  it("advances without a decision when the current card disappears", () => {
    const s = sync(createDeck(items("a", "b", "c")), "b", "c");
    expect(id(current(s))).toBe("b");
    expect(s.history).toEqual([]);
  });

  it("appends new items (load more)", () => {
    const s = sync(createDeck(items("a")), "a", "b");
    expect(remaining(s)).toBe(2);
  });

  it("is idempotent for the same ids", () => {
    const s0 = decide(createDeck(items("a", "b", "c")), "save");
    const s1 = sync(s0, "a", "b", "c");
    expect(s1.order).toEqual(s0.order);
    expect(s1.cursor).toBe(s0.cursor);
    expect(s1.history).toEqual(s0.history);
  });

  it("refreshes data for an id it has already seen", () => {
    const s0 = createDeck([{ paper: { id: "a" }, v: 1 }]);
    const s1 = deckReducer(s0, { type: "replaceUpcoming", items: [{ paper: { id: "a" }, v: 2 }] });
    expect(current(s1)?.v).toBe(2);
  });

  it("undo restores a paper no longer in items", () => {
    let s = decide(createDeck(items("a", "b")), "save");
    s = sync(s, "b");
    s = undo(s);
    expect(id(current(s))).toBe("a");
  });
});
