# 04 — Swipe

**Owner:** Dev B
**Owned paths:** `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`, `src/app/api/projects/[projectId]/swipes`
**Depends on:** F-14; SW-04 needs AI-04, SW-05 needs F-10
**Can start with fixtures?** Yes — `PaperCard` already renders fixtures

- [x] SW-01 (PR #3) ⚡ Card component (title, venue/year, overview, why-it-matters, relevance bar, stance chips, credibility badge with tooltip of inputs) — static version exists in `components/swipe/paper-card.tsx`
- [x] SW-02 (PR #4) ⚡ Gesture deck with `motion` (drag, fling thresholds, undo last), keyboard ← → ↑ Z
- [~] @Mr-Moody feat/swipe-detail-sheet SW-03 Detail sheet (full abstract, methodology, limitations, links)
- [ ] SW-04 Queue state: prefetch/analyse 3 ahead, skeletons, empty/"load more" states
- [x] SW-05 (PR #5) Persist swipes to Supabase; optimistic UI
- [ ] SW-06 Mobile polish + reduced-motion fallback (buttons)
