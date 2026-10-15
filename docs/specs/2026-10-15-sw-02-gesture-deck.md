# SW-02 — Gesture deck

**Goal:** the demo's core moment. A student (or judge, on a phone) swipes through paper cards: right saves, left skips, up opens details. It feels physical, is fully usable by keyboard, buttons and screen reader, and never decides a card by accident. Built on fixtures; reports decisions through callbacks so SW-03/04/05, RK-02 and AX-\* plug in without touching gesture code.

## Units

| File (`src/components/swipe/`) | Job                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deck-state.ts` (+ test)       | Pure reducer `{ order, cursor, history[] }`; actions `decide`, `undo`, `replaceUpcoming(ids)`; selectors `current`, `upcoming(n)`, `canUndo`, `remaining`. Dedupes ids. |
| `gesture.ts` (+ test)          | `classifyGesture({ x, y, vx, vy, width })` → `"save" \| "skip" \| "details" \| null`.                                                                                   |
| `swipe-deck.tsx` (client)      | Top card draggable + 2 peeking cards, stamps, keyboard, live region, empty state.                                                                                       |
| `deck-controls.tsx`            | Skip · Undo · Save buttons.                                                                                                                                             |

```ts
// DeckItem = { paper: Paper; analysis: PaperAnalysis; credibility: Credibility } (same shape as FixtureEntry)
<SwipeDeck items={DeckItem[]} claims={ProjectContext["claims"]}
  onDecide?(paperId, decision) onUndo?(paperId, decision) onDetails?(paperId) onEmpty?() />
```

`/app/p/[projectId]` renders it with fixtures inside `<Suspense>`.

## Interaction

- **Drag (top card):** `x`/`y` motion values; rotate ±12° over ±200px; SAVED (teal) / SKIP (`challenges`) stamp opacity 0→1 over 40–120px. Spring stiffness 300, damping 30.
- **Commit:** save/skip if |x| > 30% of card width, or |vx| > 500 px/s with |x| ≥ 40. Details if (y < −100 or vy < −600) and |y| > 1.2·|x|. Else snap back. Down never commits.
- **Exit:** card flies off in that direction keeping velocity; decision dispatched on completion. Details = snap back + `onDetails` (card stays).
- **Interactive children:** drag starts via `useDragControls` (`dragListener={false}`) only if the pointerdown target is not inside `button, a, [role=dialog]`. Card uses `touch-action: pan-y` so the page still scrolls.
- **Keyboard (window):** → save, ← skip, ↑ details, Z undo. Ignored with Ctrl/Meta/Alt, `defaultPrevented`, or target in `input, textarea, [contenteditable], [role=dialog]`. Space/Enter never handled (Space reserved for AX-02).
- **Busy lock:** input ignored while a card animates (~250ms).
- **Undo (full history):** last card re-enters from the side it left, springs to centre; `onUndo` fires. Available from the empty state.
- **Buttons:** `Skip` / `Undo` / `Save` (primary), icon + label, ≥ 44px; Undo disabled when `!canUndo`; key hints on `md:` only. Same exit animation as gestures.
- **Back cards:** next two at scale 0.96/0.92, y +8/+16px, `inert` + `aria-hidden`; spring forward when the top card leaves.
- **Screen reader / focus:** polite live region — "Saved: ‹title›. 14 left." / "Skipped: …" / "Restored: …". Deck region labelled "Paper 6 of 20"; if focus was inside the departed card it moves to that region.
- **Reduced motion:** no drag/rotation/fling; 150ms cross-fade; stamp flashes in place. Keys and buttons unchanged.
- **Empty:** paper-card-shaped panel "You've been through every paper." + Undo + Library link; `onEmpty` fires once.

## Edge cases

0/1/2 items; duplicate ids; `items` changing (history and current card kept, decided papers never reappear; current card removed → advance without a decision); pointer cancel → snap back; resize mid-drag (width read at release); a callback throws → caught + logged, deck state intact.

## Testing

TDD for `deck-state` (decide, undo order, undo on empty, `replaceUpcoming`, dedupe, counts) and `gesture` (threshold edges 29/31%, fast short flick vs slow short drag, up vs diagonal, down, zero velocity). Manual via Playwright at 360px + desktop, light/dark, reduced motion: drag-save, fling-skip, double undo, keys, chip tap doesn't drag, key inside open popover ignored, empty state. Then `a11y-reviewer`, `pr-reviewer`, `pnpm check && pnpm build`.

## Out of scope

Details sheet (SW-03), queue/prefetch/skeletons (SW-04), persistence (SW-05), re-ranking (RK-02), read-aloud/voice (AX-02/03), haptics and final mobile polish (SW-06), `useAs` picker.
