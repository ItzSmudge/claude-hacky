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
