# RD-04 — Lit-review scaffold

**Goal.** Turn a project's saved library into a starting outline for a literature review: a few
sections, each with short talking points, and every point backed by `\cite{}` keys that are
guaranteed to exist in the student's exported `.bib`. It closes the loop from swipe → library →
export → something they can start writing in.

**Decisions (made by Claude, user opted out of questions).**

- Built on the AI-05 Relations pattern: SMART model sees papers only as aliases `P1…Pn`, returns
  JSON validated by zod; code maps aliases to ids, drops unknowns, renders all bibliographic data.
- Lives on the Library page as a panel under "How your papers connect", above Export.
- Not stored: generated on demand, like Relations.

## User flow

1. Library page → panel "Lit-review outline" → button **Draft an outline**.
2. Loading state (status announced via `role="status"`), then the outline renders: section
   headings, bullet points, and after each point its cite keys in JetBrains Mono.
3. **Copy LaTeX** (`\section{…}` + `\begin{itemize}\item … \cite{a,b}\end{itemize}`) and
   **Copy Markdown** (`## …` + `- … [@a; @b]`). **Refresh** regenerates.
4. A footnote lists saved papers the outline didn't use (computed by code).

## Inputs / outputs

- `POST /api/analyse/outline { projectId }` → `{ outline: ProjectOutline }`. Members only (401),
  RLS via `loadSavedLibrary` (404/500), 55 s deadline, 502 on model failure — same as relations.
- Model reply (`outlineOutputSchema` in `src/lib/ai/schemas.ts`): `sections` (≤ 6), each
  `heading` (≤ 8 words, no links) and `points` (≤ 5), each `text` (≤ 30 words, no links) and
  `papers` (aliases).
- `ProjectOutline`: `{ projectId, paperCount, sections: [{ heading, points: [{ text, paperIds }] }] }`.
- Cite keys come only from `citeKeys(savedPapers)` (same function as the BibTeX export), so every
  `\cite` in the copied LaTeX resolves against the exported `.bib`.

## Validation (the point of the task)

- Unknown aliases discarded; points left with no papers dropped; sections left with no points
  dropped; headings/points that echo a saved paper's title dropped (reuse relations' check).
- Pure renderer `outlineLatex/outlineMarkdown(outline, keys)` skips any id with no key; unit test
  asserts every key in the output is in the library's key set.
- Word limits enforced by zod; prompt forbids titles, authors, years, venues, DOIs, URLs, citations.

## Edge cases

- Fewer than 2 saved papers → no model call; panel says "Save at least two papers first."
- More than 30 → `selectPapers` cap (most relevant first); the rest appear under "not used".
- Model returns nothing usable → "Couldn't draft an outline from these papers. Try again."
- Dark mode, keyboard-only, mobile width; copy buttons announce "Copied" via status region.

## Out of scope

Persisting or editing outlines, prose paragraphs, `.tex` file download, Overleaf, per-claim
structure toggles, group-specific views.

**Ownership note.** RD-04 has no owned paths; this touches `src/lib/ai`, `src/lib/export`,
`src/app/api/analyse/outline`, and `src/components/library` + the library page (one import).
