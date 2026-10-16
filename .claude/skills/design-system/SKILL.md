---
name: design-system
description: Use for ANY UI work in this repo — colours, components, layout, copy. PaperCut's palette (Ink Teal + Parchment Cream), tokens, themes, typography, paper-card anatomy, motion, voice and do/don't rules. Load together with frontend-design before touching src/app or src/components.
---

# PaperCut design system

> Copied verbatim from docs/SETUP_PLAN.md §2b (Phase 0). The design owner (Dev C) may extend this
> file but must not change the brand hexes. Tokens are implemented in `src/app/globals.css`;
> the live reference is `/app/_styleguide`.

## Implementation notes (added in F-14)

- Tailwind classes available: `bg-background text-foreground bg-card bg-primary text-primary-foreground bg-secondary bg-muted text-muted-foreground bg-accent border-border ring-ring`, `bg-highlight text-highlight-foreground` (the "why it matters" strip), semantic `text-supports text-challenges text-neutral bg-warning text-info`, brand `bg-brand-teal bg-brand-cream`, full scales `bg-teal-50…950`, `bg-cream-50…950`, `shadow-paper`, `shadow-paper-lg`, fonts `font-display font-sans font-mono`.
- Dark mode = `.dark` on `<html>`; high-contrast = `.hc` on `<html>` (variant `hc:`).
- Reusable pieces: `components/swipe/paper-card.tsx`, `stance-chip.tsx`, `credibility-badge.tsx`, `components/brand/logo.tsx`, `components/theme/theme-toggle.tsx`.
- Never write hex values in `.tsx` — CI-adjacent check: `grep -rE "#[0-9a-fA-F]{6}" src/components src/app --include=*.tsx` must be empty.

Every agent building UI reads this section (it is copied verbatim into `.claude/skills/design-system/SKILL.md` in Phase 0) and uses the **frontend-design** skill on top of it. No hex values in components: only the tokens below.

## Concept: "the reading room"

Scholarly but playful. Papers are **index cards** on a warm cream desk, written in deep teal ink. The swipe is the fun part; everything around it is calm, quiet and readable. Think library card catalogue meets a modern mobile app, not a SaaS dashboard.

## Brand colours

| Role      | Name                | Hex       | Use                                                                                        |
| --------- | ------------------- | --------- | ------------------------------------------------------------------------------------------ |
| Primary   | **Ink Teal**        | `#035352` | Primary buttons, links, headings on cream, active states, "save" stamp, logo               |
| Secondary | **Parchment Cream** | `#F3E8BC` | Marketing section backgrounds, highlight surfaces, text/buttons on teal, dark-mode primary |

Contrast check: `#035352` on `#F3E8BC` ≈ **7.2:1** (passes WCAG AAA for body text). Teal on white ≈ 8.9:1. Both brand colours can carry text on each other in either direction.

## Extended scales (derived — use these, don't invent new shades)

| Step | Teal                  | Cream                 |
| ---- | --------------------- | --------------------- |
| 50   | `#EEF7F6`             | `#FDFAF0`             |
| 100  | `#D6ECEA`             | `#FAF4DE`             |
| 200  | `#A9D6D3`             | **`#F3E8BC`** (brand) |
| 300  | `#74BAB7`             | `#E9D894`             |
| 400  | `#3F9C99`             | `#DCC46A`             |
| 500  | `#1A7F7C`             | `#C9AB47`             |
| 600  | `#0A6664`             | `#A88A2E`             |
| 700  | **`#035352`** (brand) | `#7F6821`             |
| 800  | `#023F3E`             | `#574716`             |
| 900  | `#012C2B`             | `#3A2F0E`             |
| 950  | `#011D1C`             | `#211A07`             |

## Semantic colours (harmonised with the palette; never pure red/green)

| Token        | Hex                       | Meaning                                       |
| ------------ | ------------------------- | --------------------------------------------- |
| `supports`   | `#2E7D4F`                 | Stance: supports / "use as evidence"          |
| `challenges` | `#B5483B`                 | Stance: challenges / skip stamp / destructive |
| `neutral`    | `#6B6F66`                 | Stance: neutral                               |
| `unclear`    | `#6B6F66` + dashed border | Stance: unclear / "not stated"                |
| `warning`    | `#C9AB47` (cream-500)     | Low credibility, rate-limit notices           |
| `info`       | `#3F9C99` (teal-400)      | Tips, adaptive-ranking insight toast          |

Stance is **never conveyed by colour alone**: every chip has an icon + label (`ThumbsUp Supports`, `Swords Challenges`, `Minus Neutral`, `HelpCircle Unclear`).

## Themes

**Light (default)**

- Page background `cream-50 #FDFAF0`; marketing alternates teal-700 bands and `#F3E8BC` bands.
- Cards (paper index cards) `#FFFDF7`, 1px border `cream-300`, soft warm shadow.
- Body text `teal-950 #011D1C`; muted text `teal-800` at 70% opacity; headings `teal-700`.
- Primary button: teal-700 bg, cream text. Secondary: `#F3E8BC` bg, teal-700 text. Ghost: teal-700 text.

**Dark** (respect `prefers-color-scheme`, toggle in app header)

- Background `teal-950 #011D1C`, cards `teal-900 #012C2B`, border `teal-800`.
- Text `#F3E8BC`; muted text cream at 65%.
- **Primary flips to cream**: `#F3E8BC` bg with teal-900 text.

**High-contrast** (a11y toggle, AX-04): text pure `teal-950` on `#FFFFFF`, borders 2px teal-700, no transparency, larger focus rings.

## Tokens — `src/app/globals.css` (Tailwind v4 + shadcn variables)

```css
:root {
  --brand-teal: #035352;
  --brand-cream: #f3e8bc;

  --background: #fdfaf0;
  --foreground: #011d1c;
  --card: #fffdf7;
  --card-foreground: #011d1c;
  --popover: #fffdf7;
  --popover-foreground: #011d1c;
  --primary: #035352;
  --primary-foreground: #f3e8bc;
  --secondary: #f3e8bc;
  --secondary-foreground: #035352;
  --muted: #faf4de;
  --muted-foreground: #3b5654;
  --accent: #d6ecea;
  --accent-foreground: #023f3e;
  --destructive: #b5483b;
  --border: #e9d894;
  --input: #e9d894;
  --ring: #1a7f7c;
  --radius: 1rem;

  --supports: #2e7d4f;
  --challenges: #b5483b;
  --neutral: #6b6f66;
  --warning: #c9ab47;
  --info: #3f9c99;
}
.dark {
  --background: #011d1c;
  --foreground: #f3e8bc;
  --card: #012c2b;
  --card-foreground: #f3e8bc;
  --popover: #012c2b;
  --popover-foreground: #f3e8bc;
  --primary: #f3e8bc;
  --primary-foreground: #012c2b;
  --secondary: #023f3e;
  --secondary-foreground: #f3e8bc;
  --muted: #023f3e;
  --muted-foreground: #a9d6d3;
  --accent: #0a6664;
  --accent-foreground: #f3e8bc;
  --destructive: #d9705f;
  --border: #023f3e;
  --input: #023f3e;
  --ring: #74bab7;

  --supports: #5fb585;
  --challenges: #e08a7c;
  --neutral: #a3a79c;
  --warning: #e9d894;
  --info: #74bab7;
}
@theme inline {
  --color-brand-teal: var(--brand-teal);
  --color-brand-cream: var(--brand-cream);
  --color-supports: var(--supports);
  --color-challenges: var(--challenges);
  --color-neutral: var(--neutral);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --font-display: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
}
```

(Keep shadcn's existing `@theme inline` mappings for background/primary/etc.; add the lines above.)

## Typography (via `next/font/google`)

- **Display:** Fraunces (headings, paper titles on cards, marketing hero). Weight 600, tight tracking.
- **Body/UI:** Inter.
- **Mono:** JetBrains Mono for `\cite{}` keys, BibTeX previews, DOIs.
- Scale: hero `text-5xl md:text-7xl`, page title `text-3xl`, card title `text-xl` (max 3 lines, clamp), body `text-base`, meta `text-sm`. Body line-height 1.6; max reading width `65ch`.

## Shape, depth, spacing

- Radius: cards `rounded-2xl`, buttons/inputs `rounded-xl`, chips `rounded-full`.
- Shadow: one warm paper shadow token, e.g. `shadow-[0_8px_24px_-12px_rgba(3,83,82,0.25)]`; top card in deck slightly stronger. No hard black shadows.
- Spacing: 4px grid; card padding `p-6` (mobile `p-5`); page gutters `px-4 md:px-8`.
- Subtle paper texture allowed on marketing only (CSS noise, ≤ 4% opacity).

## Paper card anatomy (swipe deck)

Top → bottom: venue · year · credibility badge (row, `text-sm`, muted) → title (Fraunces) → **why it matters** (teal-700 on cream-200 highlight strip, one line) → overview (≤ 35 words) → stance chips → relevance bar (teal fill on cream track, number on the right) → "Details ↑" hint.

## Motion

- Library: `motion`. Swipe uses spring (stiffness ~300, damping ~30); card rotates max 12°.
- Drag right reveals a teal **SAVED** stamp; left reveals a terracotta **SKIP** stamp (rotated, outlined, Fraunces caps).
- Transitions 150–250ms ease-out for UI; no bouncing on anything except the deck.
- `prefers-reduced-motion`: no rotation/fling, cards fade; Save/Skip buttons always visible.

## Iconography & imagery

- `lucide-react`, stroke width 1.75, size 18–20px in UI.
- Illustrations (marketing only): simple flat line art in teal on cream (index cards, bookmarks, stacked papers). No stock photos, no purple/blue AI-gradient clichés.

## Voice & copy

Friendly, short, student-to-student. "Swipe right on research." "Every citation is real." Avoid jargon in UI labels ("Saved", not "Persisted"). Empty states give one clear next action.

## Do / Don't

- ✅ Use tokens only; check contrast for any new pairing; keyboard focus ring `ring-2 ring-ring ring-offset-2`.
- ❌ No new hex values, no pure `#000`/`#FFF` backgrounds (except high-contrast mode), no gradients other than teal-700 → teal-900, no more than one primary button per view.

## Marketing patterns (added in MK-01)

Taken from the shipped landing page (`src/app/(marketing)/page.tsx`). Reuse these; don't invent new section styles.

### Section rhythm

Bands alternate so the page never has two of the same surface in a row:

| Order | Band                    | Classes                                                                     |
| ----- | ----------------------- | --------------------------------------------------------------------------- |
| 1     | Hero, teal              | `bg-teal-700 text-cream-200 hc:bg-teal-950`                                 |
| 2     | Page surface            | `bg-background`                                                             |
| 3     | Cream band              | `bg-secondary text-secondary-foreground`                                    |
| 4     | Teal band (trust/proof) | `bg-teal-700 text-cream-100 hc:bg-teal-950`                                 |
| 5     | Closing CTA, page       | `bg-background`                                                             |

- Every section: `px-4 md:px-8 py-16 md:py-24`, inner wrapper `mx-auto max-w-6xl`, `aria-labelledby` pointing at its `<h2>`.
- Heading block: small uppercase **eyebrow** (`text-sm font-medium tracking-wide uppercase`, muted) above a Fraunces `<h2>` (`font-display text-3xl md:text-4xl font-semibold text-balance text-primary`). On teal bands the h2 is `text-cream-200` and the eyebrow `text-cream-300`.
- One primary CTA per band. The hero and closing CTA both say "Try it — no signup" and link to `/app`.
- Teal bands stay teal in dark mode (they are brand surfaces); `hc:` swaps them to `teal-950`.

### Cards on bands

- On page/cream bands: `rounded-2xl border border-border bg-card p-5 md:p-6 shadow-paper hc:border-2`.
- On teal bands: `rounded-2xl border border-teal-600 bg-teal-800 p-5 md:p-6 hc:border-2 hc:border-cream-200`. The teal-600 border is decoration only (contrast with the card is low by design); the text carries the meaning.
- Numbered steps: a `size-10 rounded-full bg-primary` badge (`aria-hidden`) plus a visually hidden "Step N:" in the heading.
- Not-yet-built features get a `Coming soon` chip (`rounded-full border border-border bg-muted text-xs text-muted-foreground`), never a hidden or disabled card.

### Contrast on teal-700 (WCAG)

| Text                 | Ratio |
| -------------------- | ----- |
| cream-100 (body)     | 8.1:1 |
| cream-200 (headings) | 7.2:1 |
| cream-300 (eyebrow)  | 6.2:1 |

On teal-800 cards, cream-100 is 10.7:1. Cream-200 button with teal-900 text is 12.2:1. Don't use cream-400 or darker for text on teal.

### Focus on teal

Default `ring-ring` is too weak on teal. On any teal band use:
`focus-visible:ring-2 focus-visible:ring-cream-200 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700 focus-visible:outline-hidden hc:focus-visible:ring-4`

### Illustration style

- The hero's illustration is the live demo card stack with real fixture papers, not artwork. Prefer showing the product over drawing it.
- Icons: `lucide-react`, `strokeWidth={1.75}`, `aria-hidden` when next to text, `size-5` in cards, `size-6` for feature tiles.
- If a standalone illustration is needed (index cards, bookmarks, stacked papers): one stroke weight, rounded caps and joins, `currentColor` stroke in teal, at most one cream fill, no gradients, no people, no stock photos. Decorative art is `aria-hidden`; if it carries meaning, give it a text alternative.
- Never show invented paper details in imagery. Use fixture papers only.

### Empty and loading states

- **Anatomy:** a short Fraunces heading saying what's true ("You've seen every paper"), one muted line of why or what's next, and **one** action button. No illustration needed on in-app states.
- **Inline empty (inside a list):** one `text-sm text-muted-foreground` sentence in the user's voice, no button (e.g. "No saved paper challenges this yet.").
- **Loading:** `Skeleton` blocks shaped like the thing that is loading, inside `role="status" aria-busy="true"` with a `sr-only` "Loading …" line. Always add `motion-reduce:animate-none`. Use `DeckSkeleton` for the whole deck and `CardSkeleton` when only the card is pending.
- **Load more:** a secondary `Button` below the empty copy. Say what it does ("Load more papers"), not "Retry".
- **Errors:** say what happened and what the person can do; never show raw error text or stack traces.

### Motion on marketing

- The hero stack runs on the same spring as the deck (stiffness 300, damping 30), loops save, save, skip, and is `aria-hidden` because the hero copy says the same thing.
- Autoplay must be pausable ("Pause demo") and must not run under `prefers-reduced-motion`; hide the pause button with `motion-reduce:hidden`.
- Elements that leave the screen (swiped cards) need `overflow-x-clip` on the section so phones don't scroll sideways.
