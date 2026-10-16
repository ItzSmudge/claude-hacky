# AX-01 plan — deck keyboard and screen-reader pass

Spec: `docs/specs/2026-10-16-ax-01-deck-screen-reader.md`.

1. **Message builders (TDD).** `src/components/a11y/deck-announcements.test.ts`, then `deck-announcements.ts`: `spokenTitle`, `decisionMessage`, `undoMessage`, `arrivalMessage`, `nothingLeftMessage`. Check: `pnpm test` is red, then green.
2. **Live announcer.** `src/components/a11y/live-announcer.tsx`: `useAnnouncer()` returns `announce(text)` plus a `<LiveAnnouncer>` that re-speaks identical text (alternating trailing no-break space). Check: typecheck.
3. **Instructions.** `src/components/a11y/deck-instructions.tsx`: `sr-only` paragraph with an `id`. Check: typecheck.
4. **Wire into `swipe-deck.tsx`.**
   - Decisions and undo queue a pending message. An effect announces it once the new top card has settled, so "Next:" names the card that is actually on top after re-ranking.
   - Region name becomes "Paper n of m: <title>"; `aria-describedby` points at the instructions.
   - Announce arrivals (no top → top, not from undo) and an empty result once loading ends.
   - Check: `pnpm check`.
5. **Verify.** Use the Playwright keyboard run at 390×844: read the live region text after → ← Z, and check the region's accessible name. Then `a11y-reviewer` and `pr-reviewer`, fix what they find, and run `pnpm check && pnpm build`.
