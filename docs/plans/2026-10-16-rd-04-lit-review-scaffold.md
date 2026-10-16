# RD-04 — Lit-review scaffold: plan

> **For agentic workers:** use superpowers:executing-plans (or subagent-driven-development) task by task. Steps use `- [ ]`.

**Goal:** a "Draft a lit-review outline" panel in the Library. The SMART model drafts sections and points over saved papers (by alias); code maps them back to ids and renders `\cite{key}` only from the Library's `citeKeys()`.
**Architecture:** mirrors AI-05 relations. That means:

- `src/lib/ai/lit-review.ts` (prompt, finalise, analyse);
- `litReviewOutputSchema` in `schemas.ts`;
- `POST /api/analyse/lit-review`;
- pure renderers in `src/lib/export/outline.ts`;
- `src/components/library/lit-review-panel.tsx`, mounted on the Library page.

**Tech:** Next 16 route handler, zod 4, vitest 5, shadcn Button, lucide icons. No new dependencies.
**Spec:** `docs/specs/2026-10-16-rd-04-lit-review-scaffold.md`

## Global constraints

- The model sees papers only as `P1…Pn` (≤30 papers, abstract ≤120 words). Never send ids, authors, DOIs, URLs or citation counts. Paper text is data, not instructions.
- Schema limits: sections 1–6, points 1–5 per section, heading `words(8)`, point `words(30)`, every text field with `noLinks`. Model: `tier: "smart"`.
- Cite keys come only from `citeKeys()` (the same map as the `.bib` export); the model never writes a key.
- UI: design-system tokens only, no hex. Keyboard and screen-reader support, `aria-live` status, light, dark and `.hc`. Phone width 360px.
- Owned paths (RD-04 is whole-team): `src/lib/ai/lit-review*`, `src/lib/ai/schemas.ts` (one schema added), `src/app/api/analyse/lit-review/**`, `src/lib/export/outline*`, `src/components/library/lit-review-panel.tsx`, one mount in `src/app/app/p/[projectId]/library/page.tsx`, plus docs and the checklist line.

## Review focus

1. **LaTeX special characters** in headings and points (`& % _ # $ { } ~ ^ \`) are escaped. (Task 2 test.)
2. **Duplicate or differently cased aliases in one point** ("P3", "p3 ") become one citation. (Task 1 test.)
3. **A paper id with no cite key** (unsaved since the draft) never renders as a key; that point drops it. (Task 2 test.)
4. **Pressing the button twice while loading** doesn't start a second request. (Task 4 test.)
5. **A 502 or a network failure** shows the inline "Couldn't draft an outline — try again" with no raw error text, and the button works again. (Task 4 test.)

---

### Task 1: schema + `lit-review.ts`

**Files:** modify `src/lib/ai/schemas.ts` and `schemas.test.ts`; create `src/lib/ai/lit-review.ts` and `src/lib/ai/lit-review.test.ts`; export from `src/lib/ai/index.ts`.

**Produces:**

```ts
// schemas.ts
export const litReviewOutputSchema; // { sections: { heading, points: { text, papers: string[] }[] }[] }
export type LitReviewOutput;
export interface LitReviewOutline { sections: { heading: string; points: { text: string; paperIds: string[] }[] }[] }
// lit-review.ts
export function buildLitReviewPrompt(input: { topic: string; claims: ProjectContext["claims"]; papers: Paper[]; analyses: Map<string, PaperAnalysis> }): { system; messages; aliases: Map<string, string> };
export function finaliseLitReview(output: LitReviewOutput, aliases: Map<string, string>): LitReviewOutline;
export function draftLitReview(input: { topic; claims; papers; analyses; signal?: AbortSignal }): Promise<LitReviewOutline>;
```

- [ ] **1.1 Failing tests.**
  - **Schema:** rejects 7 sections, 6 points in a section, a 9-word heading, a 31-word point, and a URL or DOI in a point.
  - **Prompt:** uses `[P1]`…; doesn't contain any paper id, author name or DOI; includes the claims; caps at 30 papers.
  - **Finalise:** maps `P2`/`p2 ` to the id; drops unknown aliases and duplicates; drops points with no known paper and then empty sections.
  - **`draftLitReview`** (`askJson` mocked): asks `tier: "smart"`, returns the finalised outline, and propagates AI errors.
  - Run `pnpm vitest run src/lib/ai/lit-review.test.ts src/lib/ai/schemas.test.ts`. Expect FAIL.
- [ ] **1.2 Implement,** copying the shape of `relations.ts`: aliasing, `strip`, `firstWords`, and a paper block with title, abstract ≤120 words, overview and why it matters. Use `selectPapers` from `relations.ts`, exporting it if needed.
- [ ] **1.3** Run the same command. Expect PASS. Commit `feat(ai): draft lit-review outlines over saved papers`.

### Task 2: outline renderers

**Files:** create `src/lib/export/outline.ts` and `outline.test.ts`; export from `src/lib/export/index.ts` if it's a barrel.

**Produces:** `outlineToLatex(outline: LitReviewOutline, keys: Map<string, string>): string` and `outlineToMarkdown(outline, keys): string`.

- [ ] **2.1 Failing tests:**
  - LaTeX: `\section{Heading}` + `\begin{itemize}` + `\item Text \cite{k1,k2}` + `\end{itemize}`;
  - all special characters are escaped (Review focus 1);
  - a paperId missing from `keys` is omitted, and if a point then has no keys it's still listed with no `\cite` (Review focus 3);
  - Markdown: `## Heading` + `- Text [@k1; @k2]`.
  - Run `pnpm vitest run src/lib/export/outline.test.ts`. Expect FAIL.
- [ ] **2.2 Implement.** Reuse a LaTeX escape helper if `latex.ts` exports one; otherwise add a local `escapeLatex`.
- [ ] **2.3** Run the same command. Expect PASS. Commit `feat(export): render lit-review outlines as latex and markdown`.

### Task 3: route `POST /api/analyse/lit-review`

**Files:** create `src/app/api/analyse/lit-review/route.ts` and `route.test.ts`, copying `relations/route.ts` and its test.

- [ ] **3.1 Failing tests**, mocking supabase, `loadSavedLibrary` and `draftLitReview` the same way `relations/route.test.ts` does:
  - 401 when signed out;
  - 400 on a bad body;
  - 404 when the project isn't found;
  - 502 when the draft throws (with no paper text in the log);
  - 200 `{ outline }` with `Cache-Control: no-store`, the topic taken from the context, falling back to the title.
- [ ] **3.2 Implement** with `maxDuration = 60` and a 55 s deadline.
- [ ] **3.3** Run `pnpm vitest run src/app/api/analyse/lit-review`. Expect PASS. Commit `feat(ai): add lit-review outline route`.

### Task 4: panel + Library mount (load design-system + frontend-design first)

**Files:** create `src/components/library/lit-review-panel.tsx`, plus a pure state helper and its test if the logic grows (`lit-review-state.ts`). Modify `src/app/app/p/[projectId]/library/page.tsx` to mount it after `RelationsPanel` (only when 2 or more papers are saved), passing `papers` with `citeKey`.

- [ ] **4.1 Failing tests** for the pure parts: `keysFor(papers)` gives a Map of id → key; and a `canStart(state)` guard so a second click while loading doesn't fire (Review focus 4).
- [ ] **4.2 Panel:**
  - a section with `aria-labelledby` and the heading "Draft your lit review";
  - a short muted line explaining it;
  - a Button "Draft a lit-review outline", with `aria-disabled` while loading;
  - an `aria-live="polite"` status ("Drafting your outline…", "Outline ready", "Copied LaTeX");
  - the outline as `h3` and `ul`, with cite keys in `font-mono` chips;
  - **Copy LaTeX** and **Copy Markdown** buttons (`navigator.clipboard`, with an error message on failure);
  - the error line "Couldn't draft an outline — try again" (Review focus 5).

  Use the same focus-ring and `hc:` classes as `relations-panel.tsx`. Tokens only.

- [ ] **4.3 Checks:**
  - `pnpm check && pnpm build`;
  - the hex grep is empty;
  - manual check on the local stack (demo project, 5 saved papers): the outline appears, Copy LaTeX gives `\cite` keys that appear in the `.bib` export;
  - phone width and dark mode via screenshots.
- [ ] **4.4** Commit `feat(library): add lit-review outline panel`.

### Task 5: live check + review + ship prep

- [ ] **5.1** Add `src/lib/ai/lit-review.live.test.ts` (`AI_LIVE=1`). Run `draftLitReview` on 10 fixture papers. Every heading and point must pass the AI-06 text checks (no link/DOI, author surname, other papers' title runs, or citations). Run it once and record the result.
- [ ] **5.2** Run `pr-reviewer` and `a11y-reviewer` (Opus), then do one fix pass, test-first.
- [ ] **5.3** Rebase on `origin/dev`, then `pnpm check && pnpm build`. Draft the PR body and give the user the steps:
  - `--force-with-lease` (the claim was pushed);
  - push the tick before merging;
  - squash-merge.
  - **If it's past 16:30, stop after Task 3** and ship the backend plus the renderers behind the existing UI, telling the user.
