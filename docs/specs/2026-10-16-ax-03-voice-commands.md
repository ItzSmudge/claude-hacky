# AX-03 — Voice commands

**Goal:** swipe hands-free. Say "save", "skip" or "read" while looking at a card.

## User flow

- **Where:** a **Voice control** toggle above the deck (`aria-pressed`). On: "Listening. Say save, skip, undo, read, why, details or stop." Off: a hint line.
- **Commands.** The whole utterance must be the command (filler such as "um", "please" or "the card" is ignored), so normal conversation, or a screen reader on the speakers, doesn't act. Everyday single words (yes, no, next, more, back) are deliberately left out.
  - save / save it → Save;
  - skip / skip it → Skip;
  - undo / go back → Undo;
  - read / read it / listen → read the card aloud (AX-02 player);
  - why / why does it matter → read "Why it matters";
  - details / show details → open the details sheet;
  - stop / stop reading → stop reading.
- **Same code paths as the buttons:** commands go through the deck's handle (`decide`, `undo`, `details`, `topId`), so animation, announcements, saving and undo behave identically.
- **Feedback:** the command list is always visible and linked to the toggle ("Say: save · skip · … Works best with headphones."). The deck already announces save, skip and undo, so voice only announces failures and read/stop. Non-commands are shown ("Heard “…”, which isn't a command.") but not announced.
- **No hearing itself:** for 1.5 s after read-aloud plays, only "stop" is accepted.
- **Robust listening:** restarts after silence (300 ms delay). Fatal errors (blocked microphone, no microphone, offline, unsupported language) turn it off with a message. Three sessions in a row ending within 1 s also turn it off. Handlers ignore stale recognisers, and turning off or leaving the page aborts.
- **Hidden** where `SpeechRecognition` doesn't exist (Firefox). Audio goes to the browser's own speech service, never to PaperCut.

`src/components/a11y/{voice.ts (pure, tested), voice-control.tsx}`. The handle additions in `swipe-deck.tsx` and the wiring in `persisted-swipe-deck.tsx` are swipe-owned and noted in the PR.

## Out of scope

Custom wake words, other languages, voice in the group or library pages.
