# LB-01 — Library page

**Goal:** the library shows every paper saved in a project, grouped the way a student writes: by how to use it (evidence, counterpoint, method, background) or by what it says about each claim. Papers can be removed and restored. The exports (LB-03) stay below the list.

## User flow

1. From the deck ("Open your library") or the URL `/app/p/<id>/library`.
2. Default view **By use**: sections Evidence → Counterpoints → Methods → Background → Not analysed yet. Each section is sorted by credibility, highest first.
3. Toggle **By claim**: one section per project claim, listing the papers that support it and the papers that challenge it. Neutral/unclear stances are counted but not listed.
4. Each paper is a compact index card showing:
   - title, authors · venue · year, and the credibility badge;
   - the "why it matters" line and stance chips;
   - its `\cite{}` key in mono, plus a link to the paper.
5. **Remove** records the paper as _skip_, so it leaves the library and doesn't return in the deck. The card stays in place, greyed out, with **Restore** (saves again). A toast also offers Undo. Exports refresh after either action.

## Inputs / outputs

- **Server:** `loadSavedLibrary` also returns the project's claims (from `projects.context`). Credibility is recomputed with `computeCredibility`, which is deterministic and code-only.
- **Client:** `POST /api/projects/<id>/swipes` with `{ paperId, decision: "skip" | "save" }` (SW-05 route, unchanged).

## Edge cases

- Empty library: the existing "Nothing saved yet" state with a link back to swiping.
- Papers without an analysis go in "Not analysed yet", with no stance chips or "why it matters" line.
- Project without claims: the By claim toggle is hidden.
- Remove fails: the card is restored and an error toast offers Retry.
- Saves are per member. You can only remove your own save: a paper only a teammate saved shows "Saved by a teammate" with no Remove button. If you both saved it, removing yours leaves it in the library and the toast says so.

## Out of scope

Relations view (LB-04), drag-to-reorder, notes.
