import { describe, expect, it } from "vitest";
import type { PaperFeature } from "./features";
import {
  applyDeckFilters,
  findInsight,
  NO_FILTERS,
  templateSentence,
  type Insight,
} from "./insight";
import type { SwipeSample } from "./weights";

const f = (id: string, label = id): PaperFeature => ({
  id,
  kind: id.split(":")[0] as PaperFeature["kind"],
  label,
});
const review = f("study:review", "Reviews");
const preprint = f("venue:preprint", "Preprints");
const teen = f("keyword:adolescent", "adolescent");

const skip = (...features: string[]): SwipeSample => ({ features, decision: "skip" });
const save = (...features: string[]): SwipeSample => ({ features, decision: "save" });
const filler = (n: number) => Array.from({ length: n }, (_, i) => save(`keyword:w${i}`));

describe("findInsight", () => {
  const upcoming = [[review], [preprint, teen]];

  it("waits for enough swipes", () => {
    const history = [skip(review.id), skip(review.id), skip(review.id)];
    expect(findInsight(history, upcoming)).toBeNull();
  });

  it("spots a feature you keep skipping", () => {
    const history = [...filler(5), skip(review.id), skip(review.id), skip(review.id)];
    expect(findInsight(history, upcoming)).toEqual<Insight>({
      feature: review,
      direction: "skip",
      count: 3,
      total: 3,
    });
  });

  it("needs a clear majority", () => {
    const history = [
      ...filler(4),
      skip(review.id),
      skip(review.id),
      skip(review.id),
      save(review.id),
    ];
    expect(findInsight(history, upcoming)).toBeNull();
  });

  it("prefers skips over saves, then higher counts, then kind order", () => {
    const history = [
      ...filler(2),
      save(teen.id),
      save(teen.id),
      save(teen.id),
      save(teen.id),
      skip(preprint.id),
      skip(preprint.id),
      skip(preprint.id, review.id),
      skip(review.id),
      skip(review.id),
    ];
    // review and preprint both skipped 3×: study beats venue.
    expect(findInsight(history, upcoming)?.feature).toEqual(review);
    expect(findInsight(history, upcoming, { offered: new Set([review.id]) })?.feature).toEqual(
      preprint,
    );
    expect(
      findInsight(history, upcoming, { offered: new Set([review.id, preprint.id]) }),
    ).toMatchObject({ feature: teen, direction: "save", count: 4 });
  });

  it("only offers features that are still on an upcoming card", () => {
    const history = [...filler(5), skip(review.id), skip(review.id), skip(review.id)];
    expect(findInsight(history, [[preprint]])).toBeNull();
  });

  it("ignores features already hidden or boosted", () => {
    const history = [...filler(5), skip(review.id), skip(review.id), skip(review.id)];
    expect(findInsight(history, upcoming, { offered: new Set([review.id]) })).toBeNull();
  });
});

describe("templateSentence", () => {
  it("asks a question for each direction", () => {
    expect(templateSentence({ feature: review, direction: "skip", count: 3, total: 3 })).toBe(
      "You keep skipping reviews. Hide them?",
    );
    expect(templateSentence({ feature: teen, direction: "save", count: 4, total: 4 })).toBe(
      "You keep saving papers about “adolescent”. Show them first?",
    );
    expect(
      templateSentence({
        feature: f("topic:x", "Social Media Use"),
        direction: "skip",
        count: 3,
        total: 3,
      }),
    ).toBe("You keep skipping papers on Social Media Use. Hide them?");
  });
});

describe("applyDeckFilters", () => {
  const items = ["a", "b", "c", "d"];
  const feats: Record<string, string[]> = {
    a: [teen.id],
    b: [review.id],
    c: [preprint.id],
    d: [review.id, preprint.id],
  };
  const of = (id: string) => feats[id];

  it("returns the same array with no filters", () => {
    expect(applyDeckFilters(items, of, NO_FILTERS)).toBe(items);
  });

  it("hides, then moves boosted items to the front keeping order", () => {
    expect(applyDeckFilters(items, of, { hide: [review.id], boost: [] })).toEqual(["a", "c"]);
    expect(applyDeckFilters(items, of, { hide: [], boost: [preprint.id] })).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
    expect(applyDeckFilters(items, of, { hide: [review.id], boost: [preprint.id] })).toEqual([
      "c",
      "a",
    ]);
  });
});
