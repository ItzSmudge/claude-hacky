# SW-06 Mobile Polish Implementation Plan

**Goal:** deck controls always on screen on phones, haptics, touch feel, ≥ 44px targets.

**Spec:** `docs/specs/2026-10-15-sw-06-mobile-polish.md`

## Constraints

- Owned paths only: `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`. Header/sidebar/theme toggle are not ours — note them in the PR.
- Tokens only (hex grep empty); light, dark, `.hc`; respect reduced motion.
- Commits `type(swipe): lowercase summary`.

## Tasks

- [ ] **1. Sticky controls.** `swipe-deck.tsx`: wrap `<DeckControls>` in the sticky mobile bar (static from `md`). Check: audit script — Save in viewport at all sizes; end-of-page not covered.
- [ ] **2. Title + touch feel.** `page.tsx` title `text-2xl md:text-3xl`; deck region `overscroll-x-contain`; card `[-webkit-tap-highlight-color:transparent]`. Check: screenshots.
- [ ] **3. Haptics.** `haptic()` helper in `swipe-deck.tsx` (try `navigator.vibrate?.(10)`), called after a committed decide and on undo. Check: lint/typecheck; unit-free (browser API).
- [ ] **4. Badge hit area.** `credibility-badge.tsx` `after:-inset-2.5`. Check: audit measures ≥ 44px.
- [ ] **5. Review + verify.** `a11y-reviewer`, `pr-reviewer`; `pnpm check && pnpm build`; ask before opening the PR.
