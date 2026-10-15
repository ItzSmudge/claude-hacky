# SE-04 — Credibility score

**Goal:** a deterministic 0–100 credibility score for every `Paper`, computed by code from retrieved metadata, never by the model. It replaces the placeholder formula used to build the fixtures. `/api/search` (SE-05) attaches it to each result, and the card badge shows the score with its inputs.

## Inputs / outputs

`computeCredibility(paper, { now }) → Credibility` in `src/lib/credibility.ts`.

| Component   | Points | Rule                                                                                                |
| ----------- | -----: | --------------------------------------------------------------------------------------------------- |
| Citations   |   0–40 | Age-adjusted: `citations / (age + 1)` on a log scale; 50+ per year scores the full 40. Missing → 0. |
| Peer review |   0–30 | `isPeerReviewed` true → 30, false → 0, unknown → 10.                                                |
| Venue type  |   0–15 | journal 15 · conference 12 · book 10 · preprint 3 · unknown 5.                                      |
| Recency     |   0–15 | ≤ 5 years 15 · ≤ 10 years 10 · ≤ 20 years 5 · older 2 · unknown 5.                                  |

- The score is rounded to an integer and clamped to 0–100.
- `inputs` keeps the keys the badge and ranking already read: `citationCount`, `peerReviewed`, `venueType`, `year`. Missing values are left out, never guessed.
- `venueType` comes from the paper only, because the frozen `Paper` contract has no type field:
  - The venue name decides first: preprint servers → `preprint`; proceedings/conference/annual meeting → `conference`; book/eBooks/chapter/handbook → `book`.
  - Otherwise, a peer-reviewed paper is a `journal`.
  - Otherwise it's left out (unknown). The values match `VENUE_LABELS` in `src/lib/ranking/features.ts`.

## Edge cases

- Future `year` (in press) counts as age 0.
- Negative or non-finite citation counts are treated as missing.
- The same input and `now` always give the same score.

## Then

Recompute `credibility` for the 20 fixture papers with this function (`scripts/regenerate-credibility.mjs`), then run `node scripts/generate-seed.mjs` so `supabase/seed.sql` matches.

## Out of scope

Retraction data, journal impact metrics, the UI (the badge already exists), wiring into `/api/search` (SE-05).
