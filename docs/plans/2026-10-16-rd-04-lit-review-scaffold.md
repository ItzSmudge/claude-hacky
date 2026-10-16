# RD-04 Lit-review scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Library-page panel that drafts a lit-review outline from the saved papers, with `\cite` keys guaranteed to exist in the exported `.bib`.

**Architecture:** Mirrors AI-05 Relations end to end: `src/lib/ai/outline.ts` (prompt with aliases `P1…Pn` → SMART model → zod → `finaliseOutline` maps aliases to ids), `POST /api/analyse/outline`, and a client `OutlinePanel`. Pure renderers in `src/lib/export/outline.ts` turn ids into `\cite{}` / `[@key]` using `citeKeys()`.

**Tech Stack:** Next.js 16.4 route handler, zod, `askJson` (src/lib/ai/client.ts), vitest, shadcn `Button`, Tailwind tokens.

**Spec:** docs/specs/2026-10-16-rd-04-lit-review-scaffold.md

## Global Constraints

- No titles, authors, years, venues, DOIs, URLs or citations from the model; it refers to papers by alias only, unknown aliases discarded.
- All model output validated by zod in `src/lib/ai/schemas.ts`; limits: `sections` ≤ 6, `heading` ≤ 8 words, `points` ≤ 5 per section, point `text` ≤ 30 words; all `noLinks`.
- Cite keys only from `citeKeys(savedPapers)` (`@/lib/export`).
- Model tier `"smart"`, `cacheSystem: true`; route deadline 55 s, `maxDuration = 60`.
- No new dependencies, no migrations, no changes to `src/types/domain.ts` or `src/lib/api-schemas.ts`.
- Tokens/Tailwind only, cite keys in `font-mono`, light+dark, keyboard, mobile.
- Copy: panel heading "Lit-review outline"; button "Draft an outline" / "Drafting…" / "Try again" / "Refresh"; < 2 papers: "Save at least two papers first."; empty result: "Couldn't draft an outline from these papers. Try again."

## Review Focus

1. Model text containing LaTeX specials (`%`, `&`, `_`, `#`) → escaped in LaTeX output via `escapeLatex` (Task 3 test).
2. Model text mentioning an alias ("as P3 shows") → that point is dropped, never shipped with a dangling alias (Task 2 test).
3. A paper removed from the library between drafting and copying → its id is skipped by the renderer, no broken `\cite` (Task 3 test).
4. Clipboard API unavailable (insecure context / denied) → status says "Couldn't copy. Select the text instead." and nothing throws (Task 5).
5. Same paper cited twice in one point → key appears once in that `\cite{}` (Task 2 test).

---

### Task 1: Output and response schemas

**Files:**

- Modify: `src/lib/ai/schemas.ts` (append after `projectRelationsSchema`)
- Modify: `src/lib/ai/index.ts` (export the new names)
- Test: `src/lib/ai/schemas.test.ts`

**Interfaces:**

- Produces: `outlineOutputSchema` / `OutlineOutput` — `{ sections: { heading: string; points: { text: string; papers: string[] }[] }[] }`; `projectOutlineSchema` / `ProjectOutline` — `{ projectId: string; paperCount: number; sections: { heading: string; points: { text: string; paperIds: string[] }[] }[] }` (client-safe, like `projectRelationsSchema`).

- [ ] **Step 1: Failing tests** — `outlineOutputSchema` rejects a 9-word heading, a 31-word point, 7 sections, 6 points, and a point containing `https://`; accepts a valid 2-section reply. `projectOutlineSchema` rejects a point with `paperIds: []`.
- [ ] **Step 2:** `pnpm vitest run src/lib/ai/schemas.test.ts` → FAIL (not exported).
- [ ] **Step 3:** Implement with `words(n, { noLinks: true })`; `.max(6)` / `.max(5)`; `papers` described as "Aliases (e.g. P2) of the papers this point draws on."; `paperIds: z.array(z.string()).min(1)`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** `git commit -m "feat(ai): add lit-review outline schemas"`

### Task 2: Outline drafting (`src/lib/ai/outline.ts`)

**Files:**

- Create: `src/lib/ai/outline.ts`, `src/lib/ai/outline.test.ts`
- Modify: `src/lib/ai/relations.ts` — extract the title-echo check into exported `titleEchoCheck(titles: string[]): (text: string) => boolean`; `finaliseRelations` uses it (existing tests must stay green).
- Modify: `src/lib/ai/index.ts` — export `draftOutline`, `type DraftOutlineInput`.

**Interfaces:**

- Consumes: `selectPapers`, `MAX_RELATION_PAPERS`, `titleEchoCheck` (relations.ts); `askJson`; Task 1 schemas.
- Produces: `buildOutlinePrompt(context: Pick<ProjectContext,"topic"|"claims">, papers: Paper[], analyses: Map<string,PaperAnalysis>) → { system, messages, aliases: Map<string,string> }`; `finaliseOutline(output: OutlineOutput, aliases: Map<string,string>, titles?: string[]) → ProjectOutline["sections"]`; `draftOutline(input: DraftOutlineInput) → Promise<ProjectOutline>` where `DraftOutlineInput = AnalyseRelationsInput` shape (`projectId, topic, claims, papers, analyses, signal?`).

- [ ] **Step 1: Failing tests for `finaliseOutline`:** unknown alias `P99` dropped from a point; point left with no ids dropped; section left with no points dropped; point whose text matches `/\bP\d+\b/` dropped; heading echoing a 3+-word saved title drops the whole section; `["P1","p1"," P1"]` → `paperIds: ["<id1>"]`. And `draftOutline` with 1 paper returns `{ sections: [] }` without calling `askJson` (mock `./client`).
- [ ] **Step 2:** `pnpm vitest run src/lib/ai/outline.test.ts src/lib/ai/relations.test.ts` → outline FAIL.
- [ ] **Step 3:** Implement. Reuse relations' `paperBlock` (export it) so papers are shown identically. Instructions: same data/injection/no-bibliography paragraph as relations, then: "Draft the skeleton of a literature review for the brief: 3–6 sections in a sensible reading order (e.g. background, each claim or theme, methods, gaps). Each point is one sentence a student could expand into a paragraph and lists the aliases it draws on. Never write aliases inside the text. Use every paper that fits; leave out ones that don't." `effort: "low"`, `maxTokens: 8_000`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** `git commit -m "feat(ai): draft a lit-review outline from the saved papers"`

### Task 3: Renderers (`src/lib/export/outline.ts`)

**Files:**

- Create: `src/lib/export/outline.ts`, `src/lib/export/outline.test.ts`
- Modify: `src/lib/export/index.ts` (export them)

**Interfaces:**

- Consumes: `ProjectOutline["sections"]`; `escapeLatex` (bibtex.ts).
- Produces: `outlineLatex(sections, keys: Map<string,string>) → string`; `outlineMarkdown(sections, keys) → string`; `unusedPaperIds(sections, paperIds: readonly string[]) → string[]` (input order kept).

- [ ] **Step 1: Failing tests:** LaTeX for a 1-section fixture equals exactly
      `"\\section{Heading}\n\\begin{itemize}\n  \\item Text. \\cite{a2020x,b2021y}\n\\end{itemize}\n"`; Markdown equals `"## Heading\n\n- Text. [@a2020x; @b2021y]\n"`; text `"50% & x_1"` → `50\% \& x\_1`; id missing from `keys` is skipped and a point with no remaining keys renders without `\cite`; every `\cite{…}` key in output ∈ `keys.values()` (property-style over the fixture outline); `unusedPaperIds` returns ids not cited anywhere.
- [ ] **Step 2:** `pnpm vitest run src/lib/export/outline.test.ts` → FAIL.
- [ ] **Step 3:** Implement; sections joined by a blank line.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** `git commit -m "feat(export): render outlines as latex and markdown with library cite keys"`

### Task 4: Route `POST /api/analyse/outline`

**Files:**

- Create: `src/app/api/analyse/outline/route.ts`, `route.test.ts`

**Interfaces:**

- Consumes: `draftOutline` (Task 2), `loadSavedLibrary`, `projectContextSchema`.
- Produces: `200 { outline: ProjectOutline }` with `Cache-Control: no-store`; 401 "Sign in to draft an outline"; 400 invalid body; 404 "Project not found"; 500 "Couldn't load your library"; 502 "Couldn't draft an outline".

- [ ] **Step 1: Failing tests** — copy `relations/route.test.ts` mocks (swap `analyseRelations` → `draftOutline`); one test per status above; 200 body parses with `projectOutlineSchema`; topic falls back to project title when context is invalid.
- [ ] **Step 2:** `pnpm vitest run src/app/api/analyse/outline` → FAIL.
- [ ] **Step 3:** Implement as a copy of the relations route with the names swapped; log tag `[outline]`, class name only.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** `git commit -m "feat(ai): add the lit-review outline route"`

### Task 5: `OutlinePanel` on the Library page

Load `design-system` + `frontend-design` first.

**Files:**

- Create: `src/components/library/outline-panel.tsx`
- Modify: `src/app/app/p/[projectId]/library/page.tsx` — render `<OutlinePanel projectId papers />` right after `RelationsPanel` whenever any paper is saved, passing the same mapped `papers` array (hoist it to a const). With fewer than 2 papers the panel shows "Save at least two papers first." and no button.

**Interfaces:**

- Consumes: `RelationPaper` (`./relations`), `projectOutlineSchema`, `outlineLatex`, `outlineMarkdown`, `unusedPaperIds`.
- Produces: `OutlinePanel({ projectId: string; papers: RelationPaper[] })`.

- [ ] **Step 1:** Build the panel by following `relations-panel.tsx` structure exactly: same `State` union, `FriendlyError`, `FAILURE` map, `AbortController` + 65 s timeout, single action button, `role="status"` sr-only region, `aria-busy` skeleton while loading, card classes `rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6 hc:border-2`.
- [ ] **Step 2:** Done state: `<h3 font-display>` per section; `<ul>` of points, each followed by its cite keys as `<code className="font-mono text-xs">` (ids not in `papers` skipped); "Not used yet: N papers" footnote listing titles (code-rendered). Empty sections → the empty-result copy.
- [ ] **Step 3:** "Copy LaTeX" / "Copy Markdown" buttons (`variant="outline"`, `h-11`): `navigator.clipboard.writeText` in try/catch; status "Copied LaTeX outline" / "Couldn't copy. Select the text instead."; also render the LaTeX in a `<pre>` inside `<details><summary>Show LaTeX</summary>` so it can be selected manually.
- [ ] **Step 4:** `pnpm check` → PASS. Then `/run-app`, sign in as demo, Library: draft, copy, light/dark at phone width, keyboard-only tab through.
- [ ] **Step 5:** `git commit -m "feat(export): add the lit-review outline panel to the library"`

### Task 6: Verify, review, ship

- [ ] **Step 1:** `pnpm check && pnpm build` → both pass.
- [ ] **Step 2:** `pr-reviewer` and `a11y-reviewer` subagents on the branch; fix findings, re-run Step 1.
- [ ] **Step 3:** Tick RD-04 in `docs/checklists/10-release-demo.md`; `/ship-pr` (title `feat(export): draft a lit-review outline with validated cite keys`), noting in the PR body that it lands after code freeze and touches ai/export/library paths.
