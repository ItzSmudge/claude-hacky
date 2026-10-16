# AX-04 — High-contrast and larger-text toggle

**Goal:** people with low vision can switch on stronger colours and bigger text from anywhere in the app. Both settings survive a reload without a flash.

## User flow

- **Where:** the **Display settings** button (accessibility icon) beside the theme toggle in the app header opens a small panel.
- **The two switches** (`role="switch"`, with "On"/"Off" shown in words):
  - **High contrast:** stronger colours and borders, no shadows.
  - **Larger text:** `html` font size 118.75%. Everything is sized in rem, so the whole UI scales.
- A note says that motion follows the device's reduced-motion setting.
- **Remembered:** saved in localStorage (`papercut-contrast`, `papercut-text-size`) and applied by the `<head>` bootstrap script before paint, the same way as the theme.

## Palette fix

`.hc` only overrode some tokens, and it came after `.dark`. In dark mode that gave a white background with cream "primary" text, which was unreadable.

- **`.hc` (light):** now sets every reachable token, including primary, secondary, accent, the semantic colours, sidebar and shadows.
- **`.dark.hc` (new):** cream and white on black.
- The semantic colours were darkened (light) or lightened (dark) for at least about 7:1 on their background.

## Out of scope

A per-page text size control, dyslexia-friendly fonts, a reduced-motion toggle (the OS setting is respected).
