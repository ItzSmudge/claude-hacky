# SW-01 — Paper card

**Goal:** finish the swipe deck's paper index card so it works on phones, with keyboard and screen readers, and never shows broken or invented data. The F-14 static card is the starting point.

## User flow

A student sees the top card: venue, year and first author → title → why it matters → overview → stance chips → relevance → "Details" hint. Tapping the credibility badge shows how the score was built. Tapping a stance chip shows which claim it is about and the one-line note.

## Inputs / outputs

- Props unchanged: `{ paper, analysis, credibility, claims, className }` (`Paper`, `PaperAnalysis`, `Credibility`, `ProjectContext["claims"]` from `src/types/domain.ts`).
- Pure helpers in `src/components/swipe/card-format.ts` (unit tested):
  - `formatMeta(paper)` → `{ venue, year, author }` with `"not stated"` fallbacks; author = first surname-ish name + `et al.` when > 1 author.
  - `resolveStances(stances, claims)` → stances with `label` ("Claim 2") and `claimText`; unknown `claimId`s dropped.
  - `clampRelevance(n)` → integer 0–100 (NaN → 0).

## Behaviour

- **Credibility badge** → Popover (tap/click/Enter). Face: shield icon + `82/100`; scores < 40 add the word "Low" (not colour only). Content: inputs list + "Scored from metadata, not AI."
- **Stance chip** → Popover button; accessible name includes the full claim text and stance; content shows claim text + note.
- **Relevance**: visible "Relevance" label, meter with clamped value.
- **Header rule**: one thin `teal` line under the meta row (catalogue-card look). Tokens only.
- Empty overview / why-it-matters → "not stated" (muted), never an empty strip.

## Edge cases

No venue/year/authors; 0 stances (list hidden); unknown claim ids; relevance outside 0–100; very long titles (3-line clamp); long venue names (truncate); dark + high-contrast themes; 320px width; reduced motion (popovers don't animate).

## Out of scope

Drag/fling, SAVED/SKIP stamps, deck (SW-02); Details sheet and `relevanceReason` (SW-03); skeletons/queue (SW-04).

## Note for PR

Adds `src/components/ui/popover.tsx` (stock shadcn, uses existing `radix-ui` dep) — outside swipe's owned paths.
