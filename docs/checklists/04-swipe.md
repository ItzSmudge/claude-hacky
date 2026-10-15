# 04 — Swipe

**Owner:** Dev B
**Owned paths:** `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`
**Depends on:** F-14; SW-04 needs AI-04, SW-05 needs F-10
**Can start with fixtures?** Yes — `PaperCard` already renders fixtures

- [~] @Mr-Moody feat/swipe-paper-card SW-01 ⚡ Card component (title, venue/year, overview, why-it-matters, relevance bar, stance chips, credibility badge with tooltip of inputs) — static version exists in `components/swipe/paper-card.tsx`
- [ ] SW-02 ⚡ Gesture deck with `motion` (drag, fling thresholds, undo last), keyboard ← → ↑ Z
- [ ] SW-03 Detail sheet (full abstract, methodology, limitations, links)
- [ ] SW-04 Queue state: prefetch/analyse 3 ahead, skeletons, empty/"load more" states
- [ ] SW-05 Persist swipes to Supabase; optimistic UI
- [ ] SW-06 Mobile polish + reduced-motion fallback (buttons)
