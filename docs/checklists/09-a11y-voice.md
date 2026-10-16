# 09 — Accessibility & voice

**Owner:** Dev C (after marketing)
**Owned paths:** `src/components/a11y`
**Depends on:** SW-02 for deck work
**Can start with fixtures?** Yes

- [x] AX-01 ⚡ Keyboard + screen-reader pass on deck (aria-live announcements of save/skip, focus management)
- [x] AX-02 ⚡ Read-aloud: Web Speech `speechSynthesis` for overview/abstract, rate control
- [ ] AX-03 Voice commands (`SpeechRecognition` where supported): "save", "skip", "read", "why does it matter"
- [x] AX-04 High-contrast / large-text toggle (`.hc` tokens already exist in `globals.css`)
