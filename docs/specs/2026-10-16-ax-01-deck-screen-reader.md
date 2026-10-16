# AX-01 — Keyboard and screen-reader pass on the deck

**Goal:** a keyboard-only or screen-reader user (VoiceOver on iPhone, NVDA/VoiceOver on desktop) can work through the whole deck: they always know which paper is on top, what each action did, what comes next, and how to drive it, without needing to see the card move.

## What's already there (SW-02, SW-03, SW-06)

- Shortcuts ← → ↑ Z, scoped to the page body or the deck (WCAG 2.1.4); `aria-keyshortcuts` on the buttons.
- Focus moves to the deck region when the focused card leaves or a button is about to be disabled; the detail sheet returns focus.
- One `aria-live="polite"` region: "Saved: <title>. N left." and "Restored: <title>."
- Back cards are `inert`; the sticky bar never hides focus.

## Gaps found reading `swipe-deck.tsx`

1. **The new top card is never named.** After a save, focus lands on a group labelled "Paper 3 of 10", so the user hears a number, not the paper. They have to tab into the card to find out what it is.
2. **Repeated messages are dropped.** Live regions only speak when the text changes, so the same message twice in a row (e.g. "No more papers found." after a second failed Load more) is silent.
3. **Silent state changes.** Nothing announces papers finishing loading, the deck running out, "Load more" adding papers, or how many are left after an undo.
4. **Shortcuts aren't discoverable by screen-reader users.** The `<kbd>` hints are `aria-hidden` and hidden on phones; nothing describes the deck's controls.

## Changes

- **`src/components/a11y/deck-announcements.ts`** (new, pure, TDD): builds every message from deck events.
  - decide → `Saved: <title>. Next: <next title>. 4 left.` / `Skipped: …`; deck ran out → `… That's the end of the deck for now.` or `… Loading more papers.`
  - undo → `Restored: <title>. 5 left.`
  - When focus has just moved to the deck (whose name already says the top card), the new top title is left out: `Saved: <title>. 4 left.` / `Restored. 5 left.`
  - arrival (no top card → top card) → `Papers ready. First: <title>.` or, after the deck ran out, `More papers ready. Next: <title>.`
  - top card swapped without a decision (removed from results) → `Now on top: <title>.`
  - loading ends with nothing → `No papers to swipe yet.` / `No more papers found.`
  - Titles only come from `paper.title` (scholar data); long ones are cut at a word boundary.
- **`src/components/a11y/live-announcer.tsx`** (new): a polite, `sr-only`, `aria-atomic` region that re-speaks identical messages (alternates a trailing no-break space per message).
- **`src/components/a11y/deck-instructions.tsx`** (new): `sr-only` text just before the deck, so it is in reading order. It is also linked by `aria-describedby` until the deck has had focus once. It leads with the buttons, because screen-reader browse mode and phones don't send arrow keys: "Use the Skip, Undo and Save buttons after the card. With a keyboard: right arrow saves, left arrow skips, up arrow opens details and Z undoes."
- **`swipe-deck.tsx`** (swipe-owned, small wiring; noted in the PR):
  - the region's name becomes "Paper 3 of 10: <title>"
  - wire in the builder, the announcer and the instructions
  - focus moves to the region after the render that shows the new top card, not before, so focus never names the departing paper

## Edge cases

- Decision from the detail sheet: same message, focus still lands on the deck (existing behaviour).
- A card removed mid-animation: no announcement (existing guard).
- `items` replaced by re-ranking: no announcement unless the deck went from empty to non-empty or the top card itself changed.
- Reduced motion: same messages; nothing depends on animation.
- Missing or blank title → "Untitled paper".

## Out of scope

- Read-aloud (AX-02), voice commands (AX-03), high-contrast toggle (AX-04).
- A visible shortcuts dialog (`?`). Could be a follow-up if time allows.
- Toast wording (SW-05): sonner already announces its toasts.

## Testing

- Vitest for `deck-announcements.ts`: every event, last card, undo count, long and blank titles, load and load-more.
- Manual: keyboard-only run through the deck at 390×844 and desktop, VoiceOver rotor check on the region name, reduced motion on.
- Then `a11y-reviewer`, `pr-reviewer`, and `pnpm check && pnpm build`.
