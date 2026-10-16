# AI-03 Paper Analysis Implementation Plan

**Goal:** `analysePaper({ paper, projectId, context })` → a validated `PaperAnalysis` from the FAST model. It uses the paper's own text only, enforces word limits, gives a stance for every claim, and caches the project context.

**Spec:** `docs/specs/2026-10-16-ai-03-paper-analysis.md`

## Constraints

- **Owned paths:** `src/lib/ai` only. The listed owner is Dev A; Mr-Moody claimed it, so say so in the PR.
- **No changes to** contracts, deps, env or migrations. It reuses `stanceSchema`/`useAsSchema`/`paperAnalysisSchema` from `src/lib/api-schemas.ts` read-only.
- **No bibliographic fields** in the model's output schema. Papers are identified by `paperId` in code only.
- **Commits:** `type(ai): lowercase summary`.

## Tasks

- [ ] **1. Output schema (TDD), `schemas.ts`.**
  - Add `refFree()`, a refinement that rejects URLs and DOIs, and `paperAnalysisOutputSchema` with the spec's limits.
  - Tests:
    - all 20 fixture analyses (minus ids) parse;
    - over-limit text, a URL and a DOI are rejected;
    - word-limit descriptions survive in the JSON schema;
    - `betaZodOutputFormat` builds.
  - Check: `pnpm test src/lib/ai`.
- [ ] **2. Prompt builder (TDD), `paper-analysis.ts`.**
  - `buildPaperAnalysisPrompt(context, paper)` returns `{ system: [instructions, context], messages: [user <paper>] }`.
  - Deterministic text with no timestamps, so the cache prefix stays stable.
  - Strips `<paper>` tags from paper text.
  - Tests:
    - claim ids are present;
    - abstract and TLDR are present;
    - DOI, URL, authors and citation count are absent;
    - a missing abstract gives the "No abstract" line;
    - no claims gives no claims section;
    - the same context gives an identical system prompt for two papers.
- [ ] **3. Finalise (TDD).**
  - `finalisePaperAnalysis(raw, { paperId, projectId, context })`:
    - drops unknown ids;
    - keeps the first duplicate;
    - fills missing claims as `unclear`/"not stated";
    - orders stances as the context lists claims;
    - rounds relevance;
    - parses the result with `paperAnalysisSchema`.
- [ ] **4. `analysePaper` (TDD with `./client` mocked).**
  - Calls `askJson` with `tier: "fast"`, `cacheSystem: true`, `maxTokens: 2000` and the signal.
  - Returns `{ analysis, usage, repaired }`. Errors propagate.
  - Export it from `index.ts`.
- [ ] **5. Live smoke (only if `ANTHROPIC_API_KEY` is set).**
  - `scripts/ai-analyse-smoke.ts` runs 3 fixture papers through `analysePaper` and prints `cache_read_input_tokens` on papers 2–3.
- [ ] **6. Review + ship.**
  - `pr-reviewer` subagent, then `pnpm check && pnpm build`.
  - `/ship-pr`, which ticks AI-03.
