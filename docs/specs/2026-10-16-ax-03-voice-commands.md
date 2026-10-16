# AX-03 — Voice commands

**Goal:** swipe hands-free. Say "save", "skip" or "read" while looking at a card.

## User flow

- **Where:** a **Voice control** toggle above the deck (`aria-pressed`). On: "Listening. Say save, skip, undo, read, why, details or stop." Off: a hint line.
- **Commands** (whole words only, the last command in a phrase wins: "skip, no wait, save" → save):
  - save / keep / yes → Save;
  - skip / next / pass / no → Skip;
  - undo / go back → Undo;
  - read / listen → read the card aloud (AX-02 player);
  - why / why does it matter → read "Why it matters";
  - details / more → open the details sheet;
  - stop / quiet → stop reading.
- **Same code paths as the buttons:** commands go through the deck's handle (`decide`, `undo`, `details`, `topId`), so animation, announcements, saving and undo behave identically.
- **Feedback:** a polite status line ("Saved.", "Didn't catch a command in “…”").
- **No hearing itself:** while read-aloud is playing, only "stop" is accepted, so the microphone can't act on our own voice.
- **Keeps listening:** browsers end recognition after silence, so it restarts while the toggle is on. A blocked microphone shows how to allow it. Leaving the page turns it off.
- **Hidden** where `SpeechRecognition` doesn't exist (Firefox). Audio goes to the browser's own speech service, never to PaperCut.

`src/components/a11y/{voice.ts (pure, tested), voice-control.tsx}`. The handle additions in `swipe-deck.tsx` and the wiring in `persisted-swipe-deck.tsx` are swipe-owned and noted in the PR.

## Out of scope

Custom wake words, other languages, voice in the group or library pages.
