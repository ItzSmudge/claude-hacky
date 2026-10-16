# RD-04 — Lit-review scaffold

**Goal:** from a project's saved papers, Claude drafts a literature-review **outline**. Every point cites only papers in the Library, as `\cite{key}` keys that code takes from the same `citeKeys()` the `.bib` export uses. Claude never writes a key, a title or a reference.

## User flow

On the Library page, below "How your papers connect", with 2 or more saved papers:

1. The student presses **Draft a lit-review outline**. A loading line is announced.
2. The outline shows **3–6 sections**, each a heading with **2–5 points**. Each point is a sentence followed by its citations (`\cite{boer2020social, kelly2018social}`).
3. **Copy LaTeX** gives an `\section{…}` + `itemize` skeleton with `\cite` keys. **Copy Markdown** gives the same outline with `[@key]` citations. A "Copied" message confirms each.
4. Pressing the button again gives a fresh draft. Nothing is stored.

## Data flow (mirrors AI-05 relations)

- **`POST /api/analyse/lit-review`** with body `{ projectId }`:
  - Signed-in members only. It loads the library with `loadSavedLibrary` (RLS as the user), and takes the topic from the parsed brief, falling back to the title. The deadline is 55 s.
  - Responses: `200 { outline: LitReviewOutline }`, `400`, `401`, `404`, `502`.
- **`src/lib/ai/lit-review.ts`**, calling the SMART model (`askJson`, `tier: "smart"`):
  - **Prompt:** the brief's topic and claims, then each paper as `[P1]` with its title, abstract (≤120 words) and card summary (overview and why it matters), at most 30 papers. Ids, authors, DOIs, URLs and citation counts are never sent. Paper text is marked as data, not instructions.
  - **Reply schema** (`litReviewOutputSchema` in `schemas.ts`, links/DOIs banned):
    `sections` (1–6) → `{ heading: words(8), points (1–5) → { text: words(30), papers: string[] } }`.
  - **`finaliseLitReview(output, aliases)`** (pure):
    - maps aliases back to paper ids, case-insensitive and trimmed;
    - drops unknown aliases and repeats within a point;
    - drops points with no known paper, then empty sections.
    - Returns `{ sections: { heading, points: { text, paperIds } }[] }`.
- **The client renders keys:** the page already passes each paper's `citeKey` (as for `RelationsPanel`).
  - `outlineToLatex` / `outlineToMarkdown` are pure, in `src/lib/export`. LaTeX escapes special characters, and the output never contains a key the Library doesn't have.

## Errors and edge cases

- Fewer than 2 saved papers: no panel (same as relations).
- The model fails, or nothing usable survives finalising: a 502 and an inline "Couldn't draft an outline — try again" (no raw error text).
- A paper with no abstract or card: title only.

## Tests

- Prompt: aliases are used, and no id, author or DOI is sent.
- Finalise: unknown aliases dropped, empty points and sections removed.
- LaTeX/Markdown: escaping, and keys only from the map.
- Route: 401, 404, 502 and the happy path, with the AI mocked.
- Panel: idle, loading, outline and error states, plus the copy buttons, against fixtures.
- **Opt-in live test** (`AI_LIVE=1`): fixture papers through the real model, with the AI-06 `checkAnalysis`-style text checks (no URLs/DOIs, author surnames, other papers' titles or citations) applied to every heading and point.

## Out of scope

Paragraph drafting, saving or editing outlines, and the synthesis matrix.
