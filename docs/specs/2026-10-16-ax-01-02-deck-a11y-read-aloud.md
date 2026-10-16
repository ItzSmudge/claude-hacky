# AX-01 + AX-02 — Deck screen-reader pass and read-aloud

**Goal:** someone using a screen reader, a keyboard or their ears can swipe through papers as easily as someone dragging cards.

## AX-01: deck pass (from an a11y-reviewer audit)

- **After Save/Skip,** the announcement says what's on screen now, not only what left: "Saved: X. Next: Y. 18 left." On the last paper: "That was the last paper." Focus usually stays on Save/Skip, so before this the next paper was never read.
- **The deck region's name includes the paper:** "Paper 3 of 20: <title>".
- **Shortcuts are exposed:** `aria-keyshortcuts` plus a description ("Right arrow saves, left arrow skips, up arrow opens details, Z undoes."). Details shows a visible ↑ hint on larger screens.
- **Loading:** "N papers ready. <title>" when cards arrive after loading, and "No papers to swipe yet." when none come.
- **Load more** moves focus into the deck before its button unmounts.
- **Revealing the focused card above the sticky bar** never scrolls the card's title off the top.
- **Identical announcements** (undo/redo of the same paper) are read again: the region clears, then sets on the next frame.

## AX-02: read-aloud

- **Top card:** **Listen** / **Stop** reads the title, "Why it matters: …" and the overview. A speed button cycles 0.75×, 1×, 1.25×, 1.5× and is remembered on the device (try/catch localStorage).
- **Details sheet:** Listen reads the title, why it matters, the overview and the full abstract.
- **One voice at a time across the page.** Swiping the card away or closing the sheet stops it. Changing speed restarts at the new speed.
- **Long sentences are split** (Chrome stops utterances after about 15 s). Everything is queued inside the click, which iOS Safari needs. Voice language is `en-GB`.
- **Hidden** where the browser has no `speechSynthesis`.

`src/components/a11y/{speech.ts (pure, tested), read-aloud.tsx}`. One-line insertions in the swipe-owned card, deck and sheet are noted in the PR.

## Out of scope

Voice commands (AX-03), the high-contrast toggle (AX-04), highlighting words as they're read.
