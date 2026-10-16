# RK-03 — Insight toast

**Goal.** Once the deck has learnt something clear from your swipes, say it in one friendly
sentence ("You keep skipping reviews. Hide them?") and offer a single tap that acts on it:
hide upcoming papers with that feature, or move papers that have it to the front.

## User flow

Swipe ≥ 8 cards → code spots a strong pattern → toast (top, info tone) with the sentence plus
**Hide them** / **Show these first** and **Not now** → tapping the action applies a deck filter
right away. A confirmation toast offers **Undo**. Active filters are listed as small chips above
the deck ("Hidden: Reviews", with a button to show them again) and stay put on reload
(localStorage, per project). Each feature is offered at most once per project, with at least 6
swipes between insights.

## How

- **Pattern = code** (`src/lib/ranking/insight.ts`, pure, TDD). For each RK-01 feature in the
  history, count saves and skips. A candidate needs ≥ 3 swipes in one direction and ≥ 80 % of
  its swipes going that way, and must appear on at least one upcoming card. Skips beat saves
  (hiding is the more useful action), then the higher count wins, then kind order: study, venue,
  year, cited, topic, keyword.
- **Sentence = SMART model** (`src/lib/ai/insight.ts` + `POST /api/ranking/insight`). It is given
  only the feature's kind and label, the direction and the counts, and returns `{ sentence }`
  (≤ 18 words, no links, zod-validated). If the model is unavailable or slow (> 6 s), the client
  falls back to a code-made template sentence, so the toast never depends on the model.
- **Filters = code** (`applyDeckFilters`): `hide` drops matching upcoming cards and `boost` moves
  them to the front, keeping RK-02's order otherwise. It runs after `rankItems`.

## Inputs / outputs

`POST /api/ranking/insight { projectId, kind, label, direction: "skip"|"save", count, total }`
→ `200 { sentence }` | 401 | 400 | 404 (not a member) | 502.

## Edge cases

- Undoing a swipe can make a pattern disappear; nothing already shown is retracted.
- Hiding everything left in the deck shows the normal empty/load-more state, and the chip
  still offers "Show again".
- Nothing is persisted server-side, the swipes table is unchanged, and teammates aren't affected.
- Toast buttons are ≥ 44 px, the toast lasts until it's acted on or dismissed, and the meaning
  isn't carried by colour.

## Out of scope

Server-side search filters (exclude terms), group mode (RK-04), and more than one insight on
screen at a time.
