# AI-05 Relations Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `POST /api/analyse/relations` returns claim groups, method clusters and complement/contrast pairs over a project's saved papers, ids only.

**Architecture:** Pure helpers in `src/lib/ai/relations.ts` (claim grouping from stored stances, prompt builder with `P1…Pn` aliases, finaliser mapping aliases → ids) + `analyseRelations()` calling `askJson` on SMART. Route loads via `loadSavedLibrary` and returns JSON.

**Tech Stack:** Next 16 route handler, zod 4, vitest, `@anthropic-ai/sdk` via `askJson`.

**Spec:** `docs/specs/2026-10-16-ai-05-relations-analysis.md`

## Global Constraints

- Model output references papers by alias only; unknown aliases discarded; no titles/authors/years/venues/DOIs/URLs in output (`noLinks`).
- Word limits: method label ≤ 6, pair note ≤ 25. Limits: ≤ 6 method clusters, ≤ 8 pairs, ≤ 30 papers sent.
- SMART model, `effort: "low"`, `cacheSystem: true`. No new deps, no migrations, stay in `src/lib/ai` + `src/app/api/analyse`.

## Review Focus

- Model reuses one alias twice in a cluster or pairs a paper with itself → deduped / dropped (Task 1 test).
- Same pair listed as (P1,P2) and (P2,P1) → kept once (Task 1 test).
- Saved paper without stored analysis → excluded from claim groups, still sent to model with abstract (Task 1 test).
- 1 saved paper → no model call (Task 2 test).
- Not a member → 404, no model call (Task 2 test).

---

### Task 1: Relations library (schemas + pure helpers + `analyseRelations`)

**Files:**

- Modify: `src/lib/ai/schemas.ts` (add `relationsOutputSchema`, `projectRelationsSchema`, `ProjectRelations`)
- Create: `src/lib/ai/relations.ts`, `src/lib/ai/relations.test.ts`, `src/lib/ai/__fixtures__/relations.json`
- Modify: `src/lib/ai/index.ts` (export `analyseRelations`)

**Interfaces — produces:**

- `relationsOutputSchema`: `{ methods: {label: words(6), papers: string[]}[] (max 6), pairs: {a, b: string, kind: "complement"|"contrast", note: words(25,noLinks)}[] (max 8) }`
- `projectRelationsSchema` / `ProjectRelations` as in the spec.
- `groupByClaim(claims, analyses: Map<string, PaperAnalysis>, paperIds: string[]) → ProjectRelations["claims"]`
- `selectPapers(papers: Paper[], analyses) → Paper[]` (≤ 30, by relevance desc, unknown last)
- `buildRelationsPrompt({ topic, claims }, papers, analyses) → { system, messages, aliases: Map<string,string> }`
- `finaliseRelations(output, aliases) → Pick<ProjectRelations,"methods"|"pairs">`
- `analyseRelations({ projectId, topic, claims, papers, analyses, signal }) → Promise<ProjectRelations>`

- [ ] Write tests: `groupByClaim` puts supports/challenges ids per claim in claim order, ignores neutral/unclear and papers without analysis; `buildRelationsPrompt` aliases P1…Pn, includes no DOI/authors/URL, uses abstract (≤120 words) when no analysis; `finaliseRelations` drops unknown aliases, self-pairs, duplicate unordered pairs, clusters < 2 papers, dedupes aliases within a cluster; `analyseRelations` with mocked `askJson` returns ids, and with < 2 papers doesn't call it.
- [ ] Run `pnpm vitest run src/lib/ai/relations.test.ts` → FAIL.
- [ ] Implement; prompt mirrors AI-03's injection guard (`<paper>` tags, "say 'the first paper'/'the second paper', never titles").
- [ ] Run tests → PASS. Add fixture (ids from `src/fixtures`), validated by a test with `projectRelationsSchema.parse`.
- [ ] Commit `feat(ai): add relations analysis over saved papers`.

### Task 2: `POST /api/analyse/relations`

**Files:** Create `src/app/api/analyse/relations/route.ts`, `route.test.ts`.

**Interfaces — consumes:** `analyseRelations`, `loadSavedLibrary`, `projectRelationsSchema`. Body `{ projectId: uuid }` → `{ relations }`. Topic = project title (from `loadSavedLibrary`). `maxDuration = 60`, abort at 55 s.

- [ ] Tests (mock supabase server client + `@/lib/ai`, as `../route.test.ts` does): 401 signed out; 400 bad body; 404 not-found; 200 with relations parsed by `projectRelationsSchema`; model error → 502 `"Couldn't analyse relations"`.
- [ ] Run → FAIL; implement; run → PASS.
- [ ] `pnpm check && pnpm build` pass. Commit `feat(ai): add relations endpoint`.
