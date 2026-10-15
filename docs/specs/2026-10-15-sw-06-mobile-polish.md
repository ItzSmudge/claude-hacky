# SW-06 — Mobile polish and reduced-motion fallback

**Goal:** judges test on phones. On any phone, in portrait or landscape and with or without reduced motion, the Skip / Undo / Save buttons are on screen without scrolling, the deck feels physical, and nothing is too small to tap.

## What the audit found (Playwright, before this change)

| Viewport                | Page height | Save button bottom | Problem                                                                     |
| ----------------------- | ----------- | ------------------ | --------------------------------------------------------------------------- |
| 320×568                 | 1047px      | 1023px             | Controls below the fold                                                     |
| 390×844 (iPhone 13)     | 937px       | 913px              | Controls below the fold                                                     |
| 844×390 landscape       | 850px       | 826px              | Controls below the fold; only the top of the card is visible                |
| 390×844, reduced motion | 937px       | 913px              | No drag in this mode, so the buttons are the only input, and they're hidden |

The credibility badge's tap area is about 42px. The stance chips are already 44px, through a `::after` hit area. There's no horizontal overflow.

## Changes (`src/components/swipe`, deck page)

1. **Sticky control bar below `md`.** `DeckControls` sits in a `sticky bottom-0` bar with these styles:
   - full bleed (`-mx-4 px-4`)
   - `bg-background/95`, a top border and a warm paper shadow
   - bottom padding of `max(0.75rem, env(safe-area-inset-bottom))` for the iPhone home bar

   It is the last element in the deck, so at the end of the page it rests in normal flow and never covers content. From `md` up it is static, as now. With reduced motion this is the fallback: the buttons are always visible.

2. **Compact page title on phones.** `text-2xl` below `md`, `text-3xl` from `md`, to give the card more height.
3. **Haptics.** A short `navigator.vibrate(10)` when a card is saved or skipped and on undo, where supported (Android Chrome; iOS ignores it). It's wrapped in a try, and nothing else depends on it.
4. **Touch feel.**
   - The card has no grey tap flash (`-webkit-tap-highlight-color: transparent`).
   - The deck area uses `overscroll-behavior-x: contain` so a fling doesn't trigger the browser's back/forward swipe.
5. **Tap targets.** The credibility badge's hit area grows to at least 44px (`after:-inset-2.5`).

## Out of scope

- The app header, theme toggle (32px) and projects sidebar. These are owned by projects/design; I'll note them in the PR.
- Queue and skeleton states (SW-04).
- Read-aloud and voice (AX-*).

## Testing

The Playwright audit is re-run at 320×568, 390×844 (light, dark, reduced motion) and 844×390. In every case:

- The Save button is inside the viewport on load, with no scrolling.
- There's no horizontal overflow.
- Every deck control and badge hit area is at least 44px.
- After scrolling to the end, the sticky bar doesn't cover the last card content.
- A keyboard save still works and focus stays visible with the bar sticky.

Then `a11y-reviewer`, `pr-reviewer`, and `pnpm check && pnpm build`.
