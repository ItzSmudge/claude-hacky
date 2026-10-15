# RK-02 Online Weights Implementation Plan

**Goal:** learn per-feature weights from swipes and re-rank the upcoming deck after ≥ 6 swipes, undo- and reload-safe.

**Architecture:** pure `src/lib/ranking/weights.ts` (learn, idf, score, rank — unit tested) consumed by `PersistedSwipeDeck`, which holds the decision list and passes ranked items to the unchanged `SwipeDeck` (its `replaceUpcoming` keeps the top card). The page seeds the history from Supabase.

**Spec:** `docs/specs/2026-10-15-rk-02-online-weights.md`

## Constraints

- Paths: `src/lib/ranking` (ranking), `src/components/swipe/persisted-swipe-deck.tsx` and `src/app/app/p/[projectId]/page.tsx` (swipe — same owner, Dev B). No contracts, deps or migrations.
- Pure functions; no `Date.now()` in `weights.ts`; features from RK-01 only.
- Commits `type(ranking|swipe): lowercase summary`.

## Tasks

- [ ] **1. `weights.ts` (TDD).** Tests first in `weights.test.ts` (rules listed in the spec's Testing section), then implement `learnWeights`, `featureIdf`, `scorePaper`, `rankItems`; export from `index.ts`. Check: `pnpm test ranking`.
- [ ] **2. Deck wiring.** `persisted-swipe-deck.tsx`: memoised feature ids per item, `decisions` state (append / pop-matching / seed), `rankItems` memo → `SwipeDeck items`. Check: `pnpm lint && pnpm typecheck`.
- [ ] **3. Page seed.** `page.tsx`: select `paper_id, decision` ordered by `created_at`; pass `initialHistory`. Check: `pnpm build` (Cache Components clean).
- [ ] **4. Browser check.** Playwright: 6 swipes → upcoming order changes, top card unchanged; undo → original order; reload → order resumes.
- [ ] **5. Review + ship.** `pr-reviewer`; `pnpm check && pnpm build`; ask before opening the PR.
