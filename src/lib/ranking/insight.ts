import type { FeatureKind, PaperFeature } from "./features";
import type { SwipeSample } from "./weights";

/**
 * RK-03: spot one clear pattern in the swipes and act on it. Pure. The pattern and the filter
 * are code; the model only rewords the sentence (see `src/lib/ai/insight.ts`).
 */

export interface Insight {
  feature: PaperFeature;
  /** What you keep doing to papers with this feature. */
  direction: "skip" | "save";
  /** Swipes in that direction. */
  count: number;
  /** All swipes on papers with this feature. */
  total: number;
}

/** Feature ids to hide from, or move to the front of, the upcoming deck. */
export interface DeckFilters {
  hide: string[];
  boost: string[];
}
export const NO_FILTERS: DeckFilters = { hide: [], boost: [] };

const MIN_SWIPES = 8;
const MIN_COUNT = 3;
const MIN_SHARE = 0.8;
/** Most readable first: "reviews" says more than one title word. */
const KIND_ORDER: FeatureKind[] = ["study", "venue", "year", "cited", "topic", "keyword"];

/**
 * The strongest pattern worth offering, or null. Needs `minSwipes` swipes in all, and a feature
 * swiped ≥ 3 times with ≥ 80 % in one direction that is still on an upcoming card (so acting on
 * it changes something). Skips win over saves, then higher counts, then `KIND_ORDER`.
 */
export function findInsight(
  history: readonly SwipeSample[],
  upcoming: readonly (readonly PaperFeature[])[],
  { offered = new Set<string>(), minSwipes = MIN_SWIPES } = {},
): Insight | null {
  if (history.length < minSwipes) return null;
  const tally = new Map<string, { save: number; skip: number }>();
  for (const { features, decision } of history) {
    for (const id of new Set(features)) {
      const t = tally.get(id) ?? { save: 0, skip: 0 };
      t[decision] += 1;
      tally.set(id, t);
    }
  }
  const ahead = new Map(upcoming.flat().map((feature) => [feature.id, feature]));

  const candidates: Insight[] = [];
  for (const [id, { save, skip }] of tally) {
    const feature = ahead.get(id);
    if (!feature || offered.has(id)) continue;
    const total = save + skip;
    const direction = skip >= save ? "skip" : "save";
    const count = Math.max(save, skip);
    if (count >= MIN_COUNT && count / total >= MIN_SHARE) {
      candidates.push({ feature, direction, count, total });
    }
  }
  candidates.sort(
    (a, b) =>
      Number(b.direction === "skip") - Number(a.direction === "skip") ||
      b.count - a.count ||
      KIND_ORDER.indexOf(a.feature.kind) - KIND_ORDER.indexOf(b.feature.kind),
  );
  return candidates[0] ?? null;
}

/** How the feature reads inside a sentence: "reviews", "papers on Social Media Use". */
export function featurePhrase({ kind, label }: PaperFeature): string {
  switch (kind) {
    case "study":
    case "venue":
      return label.toLowerCase();
    case "topic":
      return `papers on ${label}`;
    case "keyword":
      return `papers about “${label}”`;
    case "year":
    case "cited":
      return `papers that are ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
}

/** Code-made sentence, used whenever the model's version isn't available. */
export function templateSentence({ feature, direction }: Insight): string {
  const phrase = featurePhrase(feature);
  return direction === "skip"
    ? `You keep skipping ${phrase}. Hide them?`
    : `You keep saving ${phrase}. Show them first?`;
}

/**
 * Hidden features drop out; boosted ones move to the front. Otherwise the incoming (RK-02)
 * order is kept. With no filters the same array comes back.
 */
export function applyDeckFilters<T>(
  items: T[],
  featuresOf: (item: T) => readonly string[],
  { hide, boost }: DeckFilters,
): T[] {
  if (!hide.length && !boost.length) return items;
  const hidden = new Set(hide);
  const boosted = new Set(boost);
  const shown = items.filter((item) => !featuresOf(item).some((id) => hidden.has(id)));
  const front = shown.filter((item) => featuresOf(item).some((id) => boosted.has(id)));
  return front.length ? [...front, ...shown.filter((item) => !front.includes(item))] : shown;
}
