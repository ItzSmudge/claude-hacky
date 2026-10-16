import type { SwipeDecision } from "@/types/domain";
import { combineWeights } from "./group";

/**
 * Online feature weights from swipes, and re-ranking of the upcoming deck (RK-02).
 * Pure: weights are rebuilt from the whole history each time, so undo is just a shorter history.
 */

/** One swipe: the decided paper's feature ids (from RK-01) and the decision. */
export interface SwipeSample {
  features: string[];
  decision: SwipeDecision;
}

export type Weights = Map<string, number>;

const DEFAULT_DECAY = 0.85;
const DEFAULT_MIN_SWIPES = 6;

/** Before each swipe every weight decays; then that paper's features move by ±1/√n. */
export function learnWeights(
  history: SwipeSample[],
  { decay = DEFAULT_DECAY }: { decay?: number } = {},
): Weights {
  const weights: Weights = new Map();
  for (const { features, decision } of history) {
    for (const [id, w] of weights) weights.set(id, w * decay);
    const unique = [...new Set(features)];
    if (unique.length === 0) continue;
    const step = (decision === "save" ? 1 : -1) / Math.sqrt(unique.length);
    for (const id of unique) weights.set(id, (weights.get(id) ?? 0) + step);
  }
  return weights;
}

/** idf = ln((N + 1) / (df + 1)): a feature on every paper scores 0 and can't move the order. */
export function featureIdf(pool: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const features of pool) {
    for (const id of new Set(features)) df.set(id, (df.get(id) ?? 0) + 1);
  }
  const n = pool.length;
  return new Map([...df].map(([id, count]) => [id, Math.log((n + 1) / (count + 1))]));
}

export function scorePaper(features: string[], weights: Weights, idf: Map<string, number>) {
  let score = 0;
  for (const id of new Set(features)) score += (weights.get(id) ?? 0) * (idf.get(id) ?? 0);
  return score;
}

/**
 * Upcoming items ordered by learnt preference, once there are at least `minSwipes` swipes
 * (mine plus, in group mode, teammates'). Below that, the same array is returned.
 * Stable: ties keep the incoming (relevance) order.
 */
export function rankItems<T>(
  items: T[],
  featuresOf: (item: T) => string[],
  history: SwipeSample[],
  {
    minSwipes = DEFAULT_MIN_SWIPES,
    decay = DEFAULT_DECAY,
    teamHistories = [],
    teamWeight,
  }: {
    minSwipes?: number;
    decay?: number;
    /** RK-04: one history per teammate; they count at `teamWeight` (see combineWeights). */
    teamHistories?: SwipeSample[][];
    teamWeight?: number;
  } = {},
): T[] {
  const teamSwipes = teamHistories.flat();
  if (history.length + teamSwipes.length < minSwipes || items.length < 2) return items;
  const weights = teamSwipes.length
    ? combineWeights(history, teamHistories, { decay, teamWeight })
    : learnWeights(history, { decay });
  const itemFeatures = items.map(featuresOf);
  // Distinctiveness over every paper in play: the decided ones (anyone's) and the upcoming ones.
  const idf = featureIdf([
    ...itemFeatures,
    ...history.map((s) => s.features),
    ...teamSwipes.map((s) => s.features),
  ]);
  return items
    .map((item, index) => ({ item, index, score: scorePaper(itemFeatures[index], weights, idf) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}
