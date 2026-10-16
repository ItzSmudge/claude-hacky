# LB-04 — Relations view

**Goal.** On the library page, show how the saved papers connect, using AI-05's
`POST /api/analyse/relations`: which claims the saved set argues about, which papers share a
method, and which pairs to read side by side. Every title, year and cite key on screen is
rendered by code from the saved papers. The model only supplies ids, short method labels and
pair notes.

## User flow

Library (≥ 2 saved papers) → card "How your papers connect" → button **Show how these connect**
→ loading state (skeleton, "Reading your papers…", ~10–30 s) → three sections:

1. **Claims under debate**: claims where saved papers both support and challenge, with icon
   and label for each side (`ThumbsUp Supports`, `Swords Challenges`) and the paper titles. Claims
   with only one side get a one-line summary ("3 support, none challenge"). The full lists are
   already in the "By claim" tab, so they aren't repeated here.
2. **Shared methods**: label (model, ≤ 6 words) + the titles of the papers in the group.
3. **Read together**: pairs, labelled by kind in text and icon ("Read together" for complement,
   "Read against each other" for contrast), the two titles (with year), and the note.

A **Refresh** button re-runs the analysis. Nothing is stored (as in AI-05).

## Inputs / outputs

- Props from the server page: `projectId`, `claims` (id + text), and `papers`:
  `{ id, title, year, citeKey }[]` (code-made).
- Response is parsed with `projectRelationsSchema` on the client. A pure `resolveRelations()`
  maps ids to those papers and **drops unknown ids**. Methods left with < 2 known papers and pairs
  with an unknown side are dropped too.

## Edge cases

- 0–1 saved papers: the panel isn't shown (nothing to connect).
- Empty result (no methods and no pairs): "No clear links between these papers yet. Save a few
  more and try again."
- 401 / 404 / 502 / network failure: a plain message plus **Try again**. Raw error text is never shown.
- Slow model: the button is disabled while the request runs, `aria-busy`, and an `aria-live`
  status announces "Reading your papers…" and then the result counts.
- Paper removed in another tab: its id is no longer in `papers`, so it is dropped.
- Mobile: one column; the pair's two titles stack. Keyboard: native buttons only.

## Out of scope

Persisting relations, a graph/diagram view, group-mode weighting, and changes to the AI-05
endpoint or schema.
