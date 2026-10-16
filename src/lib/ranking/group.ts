import { learnWeights, type SwipeSample, type Weights } from "./weights";

/**
 * Group mode (RK-04): rank each person's deck by the whole group's swipes.
 * Pure, like weights.ts: everything is rebuilt from histories, so a teammate's undo is a shorter one.
 */

const DEFAULT_TEAM_WEIGHT = 0.5;

/**
 * My weights plus `teamWeight` × the mean of each teammate's own weights. A mean, so a big group
 * nudges the order as much as one teammate would, and never drowns out my own taste.
 */
export function combineWeights(
  own: SwipeSample[],
  teammates: SwipeSample[][],
  { teamWeight = DEFAULT_TEAM_WEIGHT, decay }: { teamWeight?: number; decay?: number } = {},
): Weights {
  const combined = learnWeights(own, { decay });
  const active = teammates.filter((history) => history.length > 0);
  const scale = teamWeight / (active.length || 1);
  for (const history of active) {
    for (const [id, w] of learnWeights(history, { decay })) {
      combined.set(id, (combined.get(id) ?? 0) + w * scale);
    }
  }
  return combined;
}

/**
 * `next`, but with the first `n` cards of `previous` (those still in `next`) left on top, so a
 * teammate's swipe never moves the card someone is looking at or about to see.
 */
export function keepHead<T>(
  previous: T[],
  next: T[],
  n = 2,
  key: (item: T) => unknown = (item) => item,
): T[] {
  const byKey = new Map(next.map((item) => [key(item), item]));
  const head = previous.slice(0, n).flatMap((item) => {
    const kept = byKey.get(key(item));
    return kept === undefined ? [] : [kept];
  });
  const pinned = new Set(head.map(key));
  return [...head, ...next.filter((item) => !pinned.has(key(item)))];
}
