# RK-02 — Online weights and re-ranking

**Goal:** the deck adapts to the student. Each save or skip nudges the weights of that paper's RK-01 features. From the 6th swipe on, the cards still to come are re-ordered so the papers most like what they save come first. The card on screen never jumps. Undo and reload behave as expected. It's deterministic, needs no model, and runs on the client.

## Model (`src/lib/ranking/weights.ts`)

- **Learn:** `learnWeights(history, opts)`. `history` is a list of `{ features: string[], decision }` (feature ids) in swipe order.
  - Before each swipe, every existing weight decays: `w ← w · decay`, with `decay = 0.85`, so recent taste counts more.
  - Then each feature of that paper moves by `±1 / √n`, where `n` is the paper's feature count. A paper with many keywords doesn't count more.
  - Weights are always rebuilt from the full history. Undo is just "drop the last entry", with no inverse maths.
- **Distinctiveness:** `featureIdf(pool)` gives `idf(f) = ln((N + 1) / (df(f) + 1))` over the papers in the deck (decided and upcoming). A feature that every paper has ("social", "media" in the demo) gets idf = 0, so it can't change the order. RK-03 needs this same discount before naming a feature.
- **Score:** `scorePaper(features, weights, idf) = Σ w(f) · idf(f)`.
- **Rank:** `rankItems(items, featuresOf, history, { minSwipes = 6, decay = 0.85 })`.
  - Below `minSwipes`, the original order is returned unchanged (same array).
  - Otherwise there is a stable sort by score, highest first; ties keep the original (relevance) order.
  - Items carry their precomputed feature ids.

## Wiring (swipe workstream, same owner)

- **`persisted-swipe-deck.tsx`:**
  - Computes features once per item: `extractFeatures(paper, { credibility, now })`, with `now` passed down from the server so year features match `initialHistory`.
  - Keeps a `decisions` list: it appends on `onDecide` and pops the matching entry on `onUndo`. `initialHistory` (earlier visits) is joined in front of it when ranking.
  - Passes `rankItems(...)` to `SwipeDeck`, memoised so the array identity only changes when a decision or the items change.
  - The deck's existing `replaceUpcoming` keeps the top card in place and never brings back decided papers.
- **`page.tsx`:**
  - The existing swipes read now also selects `decision`, ordered by `created_at`.
  - Already-swiped papers are still filtered out of the deck. Their decisions become `initialHistory`, so a reload resumes with the learnt order.
  - Papers in the history that aren't in the fixtures are ignored.

## UX

No new UI. The deck simply serves better-matched papers after six swipes. Explaining why ("you keep skipping reviews") is RK-03.

## Edge cases

- **Fewer than 6 swipes:** no reorder.
- **All saves or all skips:** a valid ordering still comes out.
- **Undo:** undo back to 5 restores the original order; undo at 6 or more re-ranks without the undone swipe.
- **Papers with no features:** score 0, so they keep their place relative to each other.
- **A pool of 1:** returned as is.
- **A history entry for an unknown paper:** ignored.
- **The same paper decided twice** (undo, then decide again): only the latest entry remains, because undo pops it.

## Testing

**TDD for `weights.ts`:**

- signs, decay ordering (recent outweighs old), `1/√n` normalisation
- idf of 0 for universal features
- the `minSwipes` threshold at 5 and 6, stable ties, returning the same array below the threshold
- undo equals the shorter history
- the fixture scenario: save 3 reviews and skip 3 longitudinal papers, and the next upcoming card should be a review

**Browser (Playwright):** six swipes, then check that the upcoming order changed and the top card stayed; undo to five swipes and check the original order is back.

Then `pr-reviewer` and `pnpm check && pnpm build`.

## Out of scope

The insight toast and filters (RK-03), group weights (RK-04), saving weights anywhere (they're rebuilt from swipes), and model calls.
