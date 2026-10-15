# SW-02 Gesture Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A swipeable paper deck (drag/fling, keyboard, buttons, full-history undo) on `/app/p/[projectId]`, built on fixtures and exposing callbacks for SW-03/04/05, RK-02 and AX-\*.

**Architecture:** Two pure, unit-tested modules — `deck-state.ts` (reducer: order, cursor, history, known items) and `gesture.ts` (drag → save/skip/details/null) — drive a thin client component `swipe-deck.tsx` that owns `motion` values, keyboard handling, the live region and the empty state. `deck-controls.tsx` renders the button bar; `paper-card.tsx` gains an optional Details button.

**Tech Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3 (`useEffectEvent`, `inert`), `motion` 14.2 (`motion/react`), Tailwind v4 tokens, shadcn `Button`, lucide-react, vitest 5.

**Spec:** `docs/specs/2026-10-15-sw-02-gesture-deck.md`

## Global Constraints

- Work only in `.claude/worktrees/feat-swipe-gesture-deck`. Owned paths: `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`.
- Run pnpm as the pinned 12.11.2 (`corepack enable`, or prefix `corepack pnpm`). Global pnpm 9 fails with "packages field missing or empty".
- No new dependencies. No hex values in `.tsx` (`grep -rE "#[0-9a-fA-F]{6}" src/components src/app --include='*.tsx'` prints nothing). Tokens/Tailwind classes only.
- Commits: `type(scope): lowercase imperative summary`, ≤ 72 chars, scope `swipe` (or `checklist` for checklist edits).
- Thresholds (verbatim from spec): save/skip if |x| > 30% of card width, or |vx| > 500 px/s with |x| ≥ 40. Details if (y < −100, or vy < −600 with |y| ≥ 40) and |y| > 1.2·|x|. Rotate ±12° over ±200px. Stamp opacity 0→1 over 40–120px. Spring stiffness 300, damping 30. Busy lock ~250ms. Back cards scale 0.96/0.92, y +8/+16px.
- Keys: → save, ← skip, ↑ details, Z undo. Never handle Space/Enter. Ignore with Ctrl/Meta/Alt, `defaultPrevented`, or target inside `input, textarea, select, [contenteditable], [role=dialog]`.
- Card `touch-action: pan-y`; drag never starts from inside `button, a, [role=dialog]`.
- Reduced motion: no drag/rotation/fling; 150ms cross-fade; stamp flashes in place.
- Copy: "Saved: ‹title›. N left." / "Skipped: ‹title›. N left." / "Restored: ‹title›." / empty: "You've been through every paper."
- Every control ≥ 44px tall; light, dark and `.hc` themes must work.

## Review Focus

1. **Rapid repeated input** (key held, double-tapped button) → exactly one decision per animation; no card skipped silently. → Task 5 Step 4 (browser check).
2. **Touch scroll on the card** (pointer cancel mid-drag) → card snaps back, nothing decided. → Task 4 `onPointerCancel` handling + Task 5 Step 4.
3. **`items` re-passed as a new array with the same ids** (parent re-render) → no reset, no render loop, history kept. → Task 1 test "replaceUpcoming is idempotent".
4. **Undo after `items` dropped a decided paper** → that paper still comes back as the top card. → Task 1 test "undo restores a paper no longer in items".
5. **Keys pressed while a stance popover is open, or while tabbing on a card button** → popover keys don't swipe; Enter/Space activate buttons only. → Task 5 Step 4.

---

### Task 1: Deck state reducer

**Files:**

- Create: `src/components/swipe/deck-state.ts`
- Test: `src/components/swipe/deck-state.test.ts`

**Interfaces:**

- Consumes: `SwipeDecision` from `@/types/domain`.
- Produces:
  - `type Keyed = { paper: { id: string } }`
  - `interface DeckDecision { paperId: string; decision: SwipeDecision }`
  - `interface DeckState<T extends Keyed> { order: string[]; cursor: number; history: DeckDecision[]; known: Record<string, T> }`
  - `type DeckAction<T> = { type: "decide"; decision: SwipeDecision } | { type: "undo" } | { type: "replaceUpcoming"; items: T[] }`
  - `createDeck<T>(items: T[]): DeckState<T>`, `deckReducer<T>(state, action): DeckState<T>`
  - selectors `current(s): T | null`, `upcoming(s, n): T[]`, `canUndo(s): boolean`, `remaining(s): number`, `lastDecision(s): DeckDecision | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/swipe/deck-state.test.ts
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
  deckReducer(s, { type: "decide", decision });
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

  it("undo restores a paper no longer in items", () => {
    let s = decide(createDeck(items("a", "b")), "save");
    s = sync(s, "b");
    s = undo(s);
    expect(id(current(s))).toBe("a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/components/swipe/deck-state.test.ts`
Expected: FAIL — cannot resolve `./deck-state`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/swipe/deck-state.ts
import type { SwipeDecision } from "@/types/domain";

/** Pure deck state for the swipe deck. No React, no motion — unit tested. */

export type Keyed = { paper: { id: string } };

export interface DeckDecision {
  paperId: string;
  decision: SwipeDecision;
}

export interface DeckState<T extends Keyed> {
  /** Decided papers (in decision order) followed by upcoming ones. */
  order: string[];
  /** Index of the top card in `order`; always equals `history.length`. */
  cursor: number;
  history: DeckDecision[];
  /** Every item ever seen, so undo works even if `items` later drops it. */
  known: Record<string, T>;
}

export type DeckAction<T extends Keyed> =
  | { type: "decide"; decision: SwipeDecision }
  | { type: "undo" }
  | { type: "replaceUpcoming"; items: T[] };

const uniqueIds = <T extends Keyed>(items: T[]) => [...new Set(items.map((i) => i.paper.id))];

const remember = <T extends Keyed>(known: Record<string, T>, items: T[]) => {
  const next = { ...known };
  for (const item of items) next[item.paper.id] ??= item;
  return next;
};

export function createDeck<T extends Keyed>(items: T[]): DeckState<T> {
  return { order: uniqueIds(items), cursor: 0, history: [], known: remember({}, items) };
}

export function deckReducer<T extends Keyed>(
  state: DeckState<T>,
  action: DeckAction<T>,
): DeckState<T> {
  switch (action.type) {
    case "decide": {
      const paperId = state.order[state.cursor];
      if (paperId === undefined) return state;
      return {
        ...state,
        cursor: state.cursor + 1,
        history: [...state.history, { paperId, decision: action.decision }],
      };
    }
    case "undo": {
      if (state.history.length === 0) return state;
      return { ...state, cursor: state.cursor - 1, history: state.history.slice(0, -1) };
    }
    case "replaceUpcoming": {
      const decided = state.order.slice(0, state.cursor);
      const done = new Set(decided);
      const next = uniqueIds(action.items).filter((id) => !done.has(id));
      const top = state.order[state.cursor];
      const upcomingIds =
        top !== undefined && next.includes(top) ? [top, ...next.filter((id) => id !== top)] : next;
      return {
        ...state,
        order: [...decided, ...upcomingIds],
        known: remember(state.known, action.items),
      };
    }
  }
}

export const current = <T extends Keyed>(s: DeckState<T>): T | null => {
  const id = s.order[s.cursor];
  return id === undefined ? null : (s.known[id] ?? null);
};

export const upcoming = <T extends Keyed>(s: DeckState<T>, n: number): T[] =>
  s.order
    .slice(s.cursor + 1, s.cursor + 1 + n)
    .map((id) => s.known[id])
    .filter((x): x is T => x !== undefined);

export const canUndo = <T extends Keyed>(s: DeckState<T>) => s.history.length > 0;

export const remaining = <T extends Keyed>(s: DeckState<T>) => s.order.length - s.cursor;

export const lastDecision = <T extends Keyed>(s: DeckState<T>): DeckDecision | null =>
  s.history.at(-1) ?? null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/components/swipe/deck-state.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/swipe/deck-state.ts src/components/swipe/deck-state.test.ts
git commit -m "feat(swipe): add pure deck state reducer with full undo"
```

---

### Task 2: Gesture classifier

**Files:**

- Create: `src/components/swipe/gesture.ts`
- Test: `src/components/swipe/gesture.test.ts`

**Interfaces:**

- Consumes: `SwipeDecision` from `@/types/domain`.
- Produces: `GESTURE` constants; `type GestureOutcome = SwipeDecision | "details" | null`; `interface GestureInput { x: number; y: number; vx: number; vy: number; width: number }`; `classifyGesture(input: GestureInput): GestureOutcome`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/swipe/gesture.test.ts
import { describe, expect, it } from "vitest";
import { classifyGesture, type GestureInput } from "./gesture";

const g = (over: Partial<GestureInput>) =>
  classifyGesture({ x: 0, y: 0, vx: 0, vy: 0, width: 400, ...over });

describe("classifyGesture — distance (width 400 → 120px)", () => {
  it.each([
    [{ x: 116 }, null], // 29%
    [{ x: 124 }, "save"], // 31%
    [{ x: -124 }, "skip"],
    [{ x: 124, y: 150 }, "save"], // big downward drift still saves
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — fling", () => {
  it.each([
    [{ x: 50, vx: 600 }, "save"], // short fast flick
    [{ x: -50, vx: -600 }, "skip"],
    [{ x: 50, vx: 300 }, null], // short slow drag
    [{ x: 30, vx: 900 }, null], // below 40px minimum
    [{ x: 50, vx: -600 }, null], // flicking back toward centre
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — up for details", () => {
  it.each([
    [{ y: -120, x: 20 }, "details"],
    [{ y: -50, vy: -700 }, "details"], // fast upward flick
    [{ y: -20, vy: -900 }, null], // below 40px minimum
    [{ y: -120, x: 110 }, null], // diagonal: 120 < 1.2 × 110, and 110 < 120px
    [{ y: 200 }, null], // down never commits
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — degenerate input", () => {
  it("returns null for no movement", () => {
    expect(g({})).toBeNull();
  });

  it("falls back to a 320px width when width is 0", () => {
    expect(g({ width: 0, x: 100 })).toBe("save"); // 100 > 96
    expect(g({ width: 0, x: 90 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/components/swipe/gesture.test.ts`
Expected: FAIL — cannot resolve `./gesture`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/swipe/gesture.ts
import type { SwipeDecision } from "@/types/domain";

/** Turns a released drag into a deck outcome. Values from the SW-02 spec. */
export const GESTURE = {
  distanceRatio: 0.3,
  flingVelocity: 500,
  minOffset: 40,
  upDistance: 100,
  upVelocity: 600,
  verticalBias: 1.2,
  fallbackWidth: 320,
} as const;

export type GestureOutcome = SwipeDecision | "details" | null;

export interface GestureInput {
  /** Offset from rest, px. */
  x: number;
  y: number;
  /** Release velocity, px/s. */
  vx: number;
  vy: number;
  /** Current card width, px. */
  width: number;
}

export function classifyGesture({ x, y, vx, vy, width }: GestureInput): GestureOutcome {
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  const mostlyUp = y < 0 && absY > GESTURE.verticalBias * absX;
  if (
    mostlyUp &&
    (y < -GESTURE.upDistance || (absY >= GESTURE.minOffset && vy < -GESTURE.upVelocity))
  ) {
    return "details";
  }

  const w = width > 0 ? width : GESTURE.fallbackWidth;
  const side: SwipeDecision = x > 0 ? "save" : "skip";
  if (absX > w * GESTURE.distanceRatio) return side;
  if (
    absX >= GESTURE.minOffset &&
    Math.abs(vx) > GESTURE.flingVelocity &&
    Math.sign(vx) === Math.sign(x)
  ) {
    return side;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/components/swipe/gesture.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/swipe/gesture.ts src/components/swipe/gesture.test.ts
git commit -m "feat(swipe): add gesture classifier for save, skip and details"
```

---

### Task 3: Details button on the card + deck button bar

**Files:**

- Modify: `src/components/swipe/paper-card.tsx` (props + the "Details" hint at the bottom)
- Create: `src/components/swipe/deck-controls.tsx`

**Interfaces:**

- Consumes: shadcn `Button` from `@/components/ui/button` (variants `default | outline | ghost`).
- Produces:
  - `PaperCard` gains `onDetails?: () => void`. When set, renders a `<button>` "Details"; otherwise the existing static hint.
  - `DeckControls({ onSkip, onUndo, onSave, canUndo, disabled }: { onSkip: () => void; onUndo: () => void; onSave: () => void; canUndo: boolean; disabled: boolean })`.

- [ ] **Step 1: Add `onDetails` to `PaperCard`**

In `src/components/swipe/paper-card.tsx`, add the prop to the destructured props and type:

```tsx
export function PaperCard({
  paper,
  analysis,
  credibility,
  claims,
  onDetails,
  className,
}: {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
  claims: ProjectContext["claims"];
  /** Makes the "Details" hint a real button (the deck passes this for the top card). */
  onDetails?: () => void;
  className?: string;
}) {
```

Replace the final static hint:

```tsx
<p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
  <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
  Details
</p>
```

with:

```tsx
{
  onDetails ? (
    <button
      type="button"
      onClick={onDetails}
      aria-keyshortcuts="ArrowUp"
      className="mx-auto flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none"
    >
      <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
      Details
    </button>
  ) : (
    <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
      <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
      Details
    </p>
  );
}
```

- [ ] **Step 2: Create `DeckControls`**

```tsx
// src/components/swipe/deck-controls.tsx
import { Bookmark, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function Key({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden
      className="ml-1 hidden rounded border border-current/30 px-1 font-mono text-xs md:inline"
    >
      {children}
    </kbd>
  );
}

const base = "h-12 gap-2 rounded-xl text-base";

/** Skip · Undo · Save — the always-visible, non-gesture way to use the deck. */
export function DeckControls({
  onSkip,
  onUndo,
  onSave,
  canUndo,
  disabled,
}: {
  onSkip: () => void;
  onUndo: () => void;
  onSave: () => void;
  canUndo: boolean;
  disabled: boolean;
}) {
  return (
    <div role="group" aria-label="Decide on this paper" className="grid grid-cols-3 gap-3">
      <Button
        variant="outline"
        className={base}
        onClick={onSkip}
        disabled={disabled}
        aria-keyshortcuts="ArrowLeft"
      >
        <X className="size-5 text-challenges" strokeWidth={1.75} aria-hidden />
        Skip
        <Key>←</Key>
      </Button>
      <Button
        variant="ghost"
        className={base}
        onClick={onUndo}
        disabled={!canUndo}
        aria-keyshortcuts="Z"
      >
        <Undo2 className="size-5" strokeWidth={1.75} aria-hidden />
        Undo
        <Key>Z</Key>
      </Button>
      <Button className={base} onClick={onSave} disabled={disabled} aria-keyshortcuts="ArrowRight">
        <Bookmark className="size-5" strokeWidth={1.75} aria-hidden />
        Save
        <Key>→</Key>
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `corepack pnpm lint && corepack pnpm typecheck`
Expected: both pass (no consumers of `onDetails` yet; existing `PaperCard` usages unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/swipe/paper-card.tsx src/components/swipe/deck-controls.tsx
git commit -m "feat(swipe): add details button and deck button bar"
```

---

### Task 4: `SwipeDeck` component + page wiring

**Files:**

- Create: `src/components/swipe/swipe-deck.tsx`
- Modify: `src/app/app/p/[projectId]/page.tsx` (whole file)

**Interfaces:**

- Consumes: Task 1 (`createDeck`, `deckReducer`, `current`, `upcoming`, `canUndo`, `remaining`, `lastDecision`), Task 2 (`classifyGesture`), Task 3 (`PaperCard` `onDetails`, `DeckControls`).
- Produces:
  - `interface DeckItem { paper: Paper; analysis: PaperAnalysis; credibility: Credibility }`
  - `SwipeDeck(props: { items: DeckItem[]; claims: ProjectContext["claims"]; onDecide?: (paperId: string, decision: SwipeDecision) => void; onUndo?: (paperId: string, decision: SwipeDecision) => void; onDetails?: (paperId: string) => void; onEmpty?: () => void; libraryHref?: string; className?: string })`

- [ ] **Step 1: Create the component**

```tsx
// src/components/swipe/swipe-deck.tsx
"use client";

import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import type {
  Credibility,
  Paper,
  PaperAnalysis,
  ProjectContext,
  SwipeDecision,
} from "@/types/domain";
import { DeckControls } from "./deck-controls";
import {
  canUndo,
  createDeck,
  current,
  deckReducer,
  lastDecision,
  remaining,
  upcoming,
} from "./deck-state";
import { classifyGesture } from "./gesture";
import { PaperCard } from "./paper-card";

export interface DeckItem {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
}

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const FADE_S = 0.15;
const IGNORE_KEYS_IN = "input, textarea, select, [contenteditable], [role=dialog]";
const NO_DRAG_FROM = "button, a, [role=dialog]";

function safely<A extends unknown[]>(fn: ((...args: A) => void) | undefined, ...args: A) {
  try {
    fn?.(...args);
  } catch (error) {
    console.error("[SwipeDeck] callback failed", error);
  }
}

/**
 * Swipe deck: drag/fling, ← → ↑ Z, Skip/Undo/Save buttons, full-history undo.
 * State lives in deck-state.ts; this component only animates and reports via callbacks.
 */
export function SwipeDeck({
  items,
  claims,
  onDecide,
  onUndo,
  onDetails,
  onEmpty,
  libraryHref,
  className,
}: {
  items: DeckItem[];
  claims: ProjectContext["claims"];
  onDecide?: (paperId: string, decision: SwipeDecision) => void;
  onUndo?: (paperId: string, decision: SwipeDecision) => void;
  onDetails?: (paperId: string) => void;
  onEmpty?: () => void;
  libraryHref?: string;
  className?: string;
}) {
  const [deck, dispatch] = useReducer(deckReducer<DeckItem>, items, createDeck<DeckItem>);
  const reduceMotion = useReducedMotion() ?? false;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const saveStamp = useTransform(x, [40, 120], [0, 1]);
  const skipStamp = useTransform(x, [-120, -40], [1, 0]);
  const dragControls = useDragControls();

  const cardRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pointerCancelled = useRef(false);
  const entering = useRef<{ paperId: string; from: 1 | -1 } | null>(null);
  const emptyFired = useRef(false);

  const [flash, setFlash] = useState<SwipeDecision | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const top = current(deck);
  const topId = top?.paper.id ?? null;
  const behind = upcoming(deck, 2);
  const left = remaining(deck);
  const total = deck.order.length;

  // SW-04 / RK-02 feed new item arrays; only upcoming cards change.
  // Adjust-state-during-render pattern (no effect → no extra paint, lint-clean).
  const [syncedItems, setSyncedItems] = useState(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    dispatch({ type: "replaceUpcoming", items });
  }

  // New top card: reset motion values before paint, or play the undo entrance.
  useLayoutEffect(() => {
    const enter = entering.current;
    entering.current = null;
    y.jump(0);
    if (enter && enter.paperId === topId) {
      if (reduceMotion) {
        x.jump(0);
        opacity.jump(0);
        animate(opacity, 1, { duration: FADE_S });
      } else {
        opacity.jump(1);
        x.jump(enter.from * window.innerWidth);
        animate(x, 0, SPRING);
      }
      return;
    }
    x.jump(0);
    opacity.jump(1);
  }, [topId, reduceMotion, x, y, opacity]);

  const fireEmpty = useEffectEvent(() => safely(onEmpty));
  useEffect(() => {
    if (left > 0) {
      emptyFired.current = false;
    } else if (!emptyFired.current) {
      emptyFired.current = true;
      fireEmpty();
    }
  }, [left]);

  async function commit(decision: SwipeDecision, velocity = 0) {
    if (busy.current || !top) return;
    busy.current = true;
    const paper = top.paper;
    const hadFocus = cardRef.current?.contains(document.activeElement) ?? false;

    if (reduceMotion) {
      setFlash(decision);
      await animate(opacity, 0, { duration: FADE_S });
    } else {
      const target = (decision === "save" ? 1 : -1) * window.innerWidth;
      const distance = Math.abs(target - x.get());
      const duration = Math.min(0.25, Math.max(0.15, distance / Math.max(Math.abs(velocity), 1)));
      await animate(x, target, { duration, ease: "easeOut" });
    }

    dispatch({ type: "decide", decision });
    setFlash(null);
    setAnnouncement(
      `${decision === "save" ? "Saved" : "Skipped"}: ${paper.title}. ${left - 1} left.`,
    );
    if (hadFocus) regionRef.current?.focus();
    busy.current = false;
    safely(onDecide, paper.id, decision);
  }

  function undo() {
    if (busy.current) return;
    const last = lastDecision(deck);
    if (!last) return;
    entering.current = { paperId: last.paperId, from: last.decision === "save" ? 1 : -1 };
    dispatch({ type: "undo" });
    setAnnouncement(`Restored: ${deck.known[last.paperId]?.paper.title ?? "paper"}.`);
    safely(onUndo, last.paperId, last.decision);
  }

  function details() {
    if (topId) safely(onDetails, topId);
  }

  function startDrag(event: ReactPointerEvent) {
    if (reduceMotion || busy.current) return;
    if (event.target instanceof Element && event.target.closest(NO_DRAG_FROM)) return;
    pointerCancelled.current = false;
    dragControls.start(event);
  }

  function endDrag() {
    const outcome = pointerCancelled.current
      ? null
      : classifyGesture({
          x: x.get(),
          y: y.get(),
          vx: x.getVelocity(),
          vy: y.getVelocity(),
          width: cardRef.current?.offsetWidth ?? 0,
        });
    if (outcome === "save" || outcome === "skip") {
      void commit(outcome, x.getVelocity());
      return;
    }
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    if (outcome === "details") details();
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest(IGNORE_KEYS_IN)) return;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        void commit("save");
        break;
      case "ArrowLeft":
        event.preventDefault();
        void commit("skip");
        break;
      case "ArrowUp":
        event.preventDefault();
        details();
        break;
      case "z":
      case "Z":
        event.preventDefault();
        undo();
        break;
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const stack = [...behind].reverse();

  return (
    <section aria-label="Paper deck" className={cn("flex flex-col gap-4", className)}>
      <div
        ref={regionRef}
        tabIndex={-1}
        aria-label={top ? `Paper ${deck.cursor + 1} of ${total}` : "No papers left"}
        className="grid rounded-2xl *:[grid-area:1/1] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {stack.map((item, i) => {
          const depth = stack.length - i;
          return (
            <motion.div
              key={item.paper.id}
              inert
              initial={false}
              animate={{ scale: 1 - 0.04 * depth, y: 8 * depth }}
              transition={reduceMotion ? { duration: 0 } : SPRING}
              className="pointer-events-none origin-top"
            >
              <PaperCard {...item} claims={claims} />
            </motion.div>
          );
        })}

        {top ? (
          <motion.div
            key={top.paper.id}
            // A back card promoted to the top remounts here; start at depth-1 and spring forward.
            initial={reduceMotion ? false : { scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING}
            className="origin-top"
          >
            <motion.div
              ref={cardRef}
              drag={!reduceMotion}
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              onPointerDown={startDrag}
              onPointerCancel={() => {
                pointerCancelled.current = true;
              }}
              onDragEnd={endDrag}
              style={{ x, y, rotate, opacity, touchAction: "pan-y" }}
              className="relative cursor-grab select-none active:cursor-grabbing"
            >
              <PaperCard {...top} claims={claims} onDetails={details} />
              <motion.span
                aria-hidden
                style={{ opacity: flash === "save" ? 1 : saveStamp }}
                className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-lg border-4 border-primary bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-primary uppercase"
              >
                Saved
              </motion.span>
              <motion.span
                aria-hidden
                style={{ opacity: flash === "skip" ? 1 : skipStamp }}
                className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-lg border-4 border-challenges bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-challenges uppercase"
              >
                Skip
              </motion.span>
            </motion.div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-paper">
            <p className="font-display text-xl font-semibold text-primary">
              {total === 0 ? "No papers to swipe yet." : "You've been through every paper."}
            </p>
            {total > 0 && (
              <p className="text-muted-foreground">
                Undo to revisit the last one{libraryHref ? ", or open your library." : "."}
              </p>
            )}
            {libraryHref && (
              <Link
                href={libraryHref}
                className="inline-flex min-h-11 items-center rounded-xl px-4 font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Open library
              </Link>
            )}
          </div>
        )}
      </div>

      <DeckControls
        onSkip={() => void commit("skip")}
        onUndo={undo}
        onSave={() => void commit("save")}
        canUndo={canUndo(deck)}
        disabled={!top}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Wire the page**

```tsx
// src/app/app/p/[projectId]/page.tsx
import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";

// Owner: swipe (SW-*). Fixture-backed until SW-04 (queue) and SW-05 (persistence) land.
export default function DeckPage() {
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold text-primary">{fixtureProject.title}</h1>
        <SwipeDeck
          items={fixturePapers}
          claims={fixtureProject.context.claims}
          libraryHref={`/app/p/${fixtureProject.id}/library`}
        />
      </div>
    </div>
  );
}
```

(The page reads no params or request data yet, so no `<Suspense>` is needed; SW-04 adds it when it reads `params`.)

- [ ] **Step 3: Verify types, lint, build**

Run: `corepack pnpm check && corepack pnpm build`
Expected: lint, typecheck, all tests and build pass. If `react-hooks` lint flags a rule, fix the code (do not disable the rule) and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/components/swipe/swipe-deck.tsx "src/app/app/p/[projectId]/page.tsx"
git commit -m "feat(swipe): add gesture deck with keyboard, buttons and undo"
```

---

### Task 5: Browser verification + reviews

**Files:** none new (fixes go in the files above).

- [ ] **Step 1: Start the dev server** (background): `corepack pnpm dev --port 3107`, open `http://localhost:3107/app/p/00000000-0000-4000-8000-000000000001` with `playwright-cli open --mobile <url>`.

- [ ] **Step 2: Drag-save, fling-skip** with `playwright-cli run-code`:

```js
async (page) => {
  const card = page.locator("section[aria-label='Paper deck'] .cursor-grab");
  const b = await card.boundingBox();
  const cx = b.x + b.width / 2,
    cy = b.y + 120;
  // slow drag past 30% → save
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 20, cy);
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log(await page.locator("[aria-live=polite]").textContent());
  // short fast flick left → skip
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log(await page.locator("[aria-live=polite]").textContent());
};
```

Expected: "Saved: … 19 left." then "Skipped: … 18 left." Screenshot mid-drag to see the SAVED stamp and rotation.

- [ ] **Step 3: Keys + undo**: `playwright-cli press ArrowRight`, `press ArrowLeft`, `press z`, `press z` → live region ends with "Restored: …" and the position label reads "Paper 3 of 20" (4 decisions, 2 undos → cursor 2 → third paper).

- [ ] **Step 4: Review Focus checks**
  - Press `ArrowRight` three times within 100ms (`run-code` with `page.keyboard.press` ×3, no waits) → exactly one "Saved" announcement, position advanced by 1.
  - Click a stance chip (`getByRole('button', { name: /Claim 1/ })`) → popover opens, card doesn't move; press `ArrowRight` → nothing decided (focus is inside the dialog); `Escape` closes.
  - Tab to the card's "Details" button, press `Enter` → no decision; Space → no decision.
  - Emulate touch scroll: `page.touchscreen` isn't enough for pointercancel; instead `card.dispatchEvent('pointercancel')` during a mouse drag → card snaps back, no announcement.
  - Decide all 20 → empty state with "You've been through every paper.", Undo enabled, "Open library" link.

- [ ] **Step 5: Reduced motion + themes**: `run-code "async page => page.emulateMedia({ reducedMotion: 'reduce' })"`, reload, press `ArrowRight` → card fades, stamp flashes, no drag possible. Screenshot light + dark (`document.documentElement.classList.add('dark')`) at 360px and 1280px.

- [ ] **Step 6: Reviews**: run `a11y-reviewer` and `pr-reviewer` agents on `git diff origin/dev...HEAD`; fix findings (or note why not); re-run `corepack pnpm check && corepack pnpm build`; hex grep prints nothing.

- [ ] **Step 7: Commit fixes**

```bash
git add -A src/components/swipe "src/app/app/p/[projectId]/page.tsx"
git commit -m "fix(swipe): address deck review findings"
```
