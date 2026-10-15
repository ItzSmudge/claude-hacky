# SW-03 — Detail sheet

**Goal:** before deciding, a student can open the top card's full record: full abstract, methodology, limitations, stance notes per claim, full author list and links to the paper. Then they save or skip straight from the sheet. It opens with ↑, the card's Details button, or a drag up (mouse/pen). It's a bottom sheet on phones and a side panel on desktop. Built on fixtures; all bibliographic text and links are rendered from `paper` (scholar APIs), never from the model.

## Units

| File (`src/components/swipe/`)    | Job                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detail-format.ts` (+ test)       | Pure helpers. `formatAuthorList(authors, max = 8)` → "A, B, C and 5 more" / "Authors not stated". `paperLinks(paper)` → `{ label, href, kind }[]`. `orNotStated(text)`.   |
| `detail-sheet.tsx` (client)       | shadcn `Sheet`: `side="bottom"` below `md`, `side="right"` from `md`. Header (meta + credibility badge + title), sections, sticky footer with Skip / Save.                |
| `swipe-deck.tsx` (modify)         | Add an optional `ref` handle `{ decide(decision) }` so the sheet's buttons reuse the deck's exit animation, announcement, focus and callbacks. No other behaviour change. |
| `persisted-swipe-deck.tsx` (mod.) | Holds `detailsId`. `onDetails` opens the sheet for that paper; the sheet's Save/Skip close it and then call `deck.decide(...)`.                                           |

## Content (top → bottom)

1. Venue · year (muted), credibility badge, title (Fraunces `text-2xl`, not clamped), full author list.
2. **Why it matters** strip (same highlight as the card) + overview.
3. **Abstract.** `paper.abstract`, or "Abstract not stated." Max `65ch`, line-height 1.6.
4. **Methodology** and **Limitations** (analysis). Empty → "not stated".
5. **Your claims.** One row per resolved stance: the existing `StanceChip` (icon + label), the claim text, and the stance note. "not stated" notes are shown muted.
6. **Topics.** Small muted chips if any.
7. **Links.** "Open paper", "DOI" (shown as mono `10.x/…`), "PDF". Only `http(s)` URLs; the DOI is normalised (strip `doi:`/`https://doi.org/` prefixes) and linked to `https://doi.org/<doi>`; `url` is dropped when it equals the DOI link. All open in a new tab with `rel="noopener noreferrer"`, and an icon plus sr-only "(opens in new tab)" mark them.
8. Footer (sticky): `Skip` (outline) · `Save` (primary). Each closes the sheet, then the card leaves exactly as with the deck buttons.

## Interaction & a11y

- Radix Dialog: focus moves to the sheet title region on open, Esc / overlay / close button closes, and focus returns to where it was (the Details button or the deck region). Deck shortcuts are already ignored inside `[role=dialog]`.
- The sheet `aria-labelledby` the paper title and `aria-describedby` the why-it-matters line.
- Bottom sheet: `max-h-[85dvh]`, the body scrolls and the footer stays visible, `rounded-t-2xl`, safe-area padding at the bottom. Side panel: `sm:max-w-md`.
- Reduced motion: no slide, fade only (zero duration under the global reduced-motion rule).
- Every control is ≥ 44px. Light, dark and `.hc` all work. Tokens only.

## Edge cases

No abstract / methodology / limitations; no links at all (section hidden); DOI already a URL; `url` that is `javascript:` or relative (dropped); 1 vs 30 authors; very long title or abstract (scroll); the paper is removed from `items` while the sheet is open (keep showing it, since the deck keeps `known` items, and Save/Skip become no-ops if it's no longer the top card); opening details on the last card; undo while the sheet is closed (unchanged).

## Testing

TDD for `detail-format` (author list cut-offs, DOI normalisation, duplicate URL, unsafe URLs, empty paper). Playwright at 360px and 1280px, light/dark: ↑ opens it, Esc closes and focus returns, Save in the sheet saves (deck advances and announces), long abstract scrolls while the footer stays visible, Tab cycles within the sheet. Then `a11y-reviewer`, `pr-reviewer`, `pnpm check && pnpm build`.

## Out of scope

Read-aloud (AX-02), `useAs` picker, related papers / relations (AI-05), BibTeX preview (LB-02), fetching anything new (the sheet only shows data already in the deck item).
