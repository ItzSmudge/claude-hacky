# SW-03 Detail Sheet Implementation Plan

**Goal:** a details sheet for the top card (abstract, methodology, limitations, stance notes, authors, links) with Save/Skip that reuse the deck's exit.

**Architecture:** pure `detail-format.ts` (unit tested) feeds a presentational `detail-sheet.tsx` built on shadcn `Sheet`. `SwipeDeck` gains a small imperative handle (`decide`) so the sheet's buttons go through the same commit path as gestures, keys and buttons. `PersistedSwipeDeck` owns which paper is open.

**Spec:** `docs/specs/2026-10-15-sw-03-detail-sheet.md`

## Constraints

- Owned paths only: `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`. No contracts, no deps (shadcn `Sheet`, lucide and `motion` already exist).
- Bibliographic text and links come only from `paper`; analysis text only from `analysis`. Missing → "not stated".
- Tokens only (the hex grep must stay empty). ≥ 44px controls. Light, dark and `.hc`.
- Built on the SW-05 branch (PR #5): rebase onto `dev` once that merges.
- Commits `type(swipe): lowercase summary`.

## Tasks

- [ ] **1. `detail-format.ts` (TDD).** Files: `detail-format.ts`, `detail-format.test.ts`. Tests first: `formatAuthorList` (0, 1, 2, 8, 9, 30 authors; blank names skipped), `normaliseDoi` (`doi:`, `https://doi.org/`, `http://dx.doi.org/`, case, whitespace), `paperLinks` (DOI + duplicate url collapses, PDF, unsafe/relative URLs dropped, nothing → `[]`), `orNotStated`. Check: `pnpm test detail-format`.
- [ ] **2. Deck handle.** `swipe-deck.tsx`: accept `ref?: Ref<SwipeDeckHandle>`, `useImperativeHandle(ref, () => ({ decide }))`, where `decide` runs the same `canCommit()` guard + `commit()` as the buttons. Check: existing tests + `pnpm lint` (react-compiler rules).
- [ ] **3. `detail-sheet.tsx`.** Props `{ item, claims, open, onOpenChange, onDecide }`. Side from `useMediaQuery("(min-width: 768px)")` via `useSyncExternalStore` (SSR snapshot = bottom). Sections and footer per spec. Check: `pnpm lint && pnpm typecheck`; `/app/_styleguide` unaffected.
- [ ] **4. Wire up.** `persisted-swipe-deck.tsx`: `detailsId` state, `onDetails={setDetailsId}`, render `DetailSheet` for `known` item. Save/Skip → close, then `deckRef.current?.decide(d)` on the next frame (after Radix restores focus) so the deck's focus logic runs. Check: Playwright script (↑ opens, Esc returns focus, Save in sheet persists + advances, 360px scroll with footer visible, dark mode screenshot).
- [ ] **5. Review + verify.** `a11y-reviewer`, `pr-reviewer`, hex grep, `pnpm check && pnpm build`. Commit, then ask before pushing (the session's push branch is PR #5).
