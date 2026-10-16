# SE-03 — Enrich search results with Semantic Scholar: plan

> **For agentic workers:** use superpowers:executing-plans (or subagent-driven-development) task by task. Steps use `- [ ]`.

**Goal:** `/api/search` pages gain S2 TLDRs, plus S2 abstracts where OpenAlex has none, through one `/paper/batch` DOI lookup per page. This is best effort: it never slows a page past 3 s and never fails one.
**Architecture:**

- Pure merge helpers in a new `src/lib/scholar/merge.ts`.
- A batch client added to `semanticscholar.ts`.
- An optional `enrich` dependency on `searchPapers`.
- The route wires in S2 with a 3 s signal.
- `cache.ts` keeps cached `tldr`/`abstract` instead of overwriting them.

**Tech:** TypeScript, zod 4, vitest 5. No new dependencies.
**Spec:** `docs/specs/2026-10-16-se-03-merge-sources.md`

## Global constraints

- Copy S2 data only: `tldr` ← `tldr.text`, `abstract` ← `abstract` **only when the paper has none**. Every other field stays OpenAlex's, so credibility is unchanged.
- The response shape, ids, order and paging of `/api/search` are unchanged. No contract or schema edits.
- S2 budget is **3000 ms** in total (route signal), with **1 retry** (500 ms, or a `Retry-After` within the budget). On any failure, return the page unenriched and `console.warn` once, with no key and no DOIs in the message.
- The key comes only from `serverEnv()` in `index.ts`, and is sent only as the `x-api-key` header.
- Owned paths only: `src/lib/scholar/**`, `src/app/api/search/**`, plus this task's docs and checklist line.

## Review focus (inputs the spec implies but doesn't spell out)

1. **Results are matched by position, not by S2's DOI.** S2 may normalise DOIs differently, so map `ids[i]` to `response[i]`. A response array of a different length is malformed and means no enrichment. (Task 2 test.)
2. **Duplicate DOIs in one page** (two OpenAlex works with the same DOI): send each DOI once, and enrich both papers. (Tasks 1 and 2 tests.)
3. **Exclude terms vs a filled-in abstract.** A paper with no OpenAlex abstract was never checked against the abstract, so re-apply the exclude filter after enrichment. This adds to the spec's order and doesn't conflict with it. (Task 3 test.)
4. **A slow S2 must not hold the page.** The lookup honours its `signal`, so an abort during a request or a wait throws straight away, and `searchPapers` catches it. (Tasks 2 and 3 tests.)
5. **A junk cached row** (`data` is null, an array, or has a non-string `tldr`) is ignored, and the new paper is used as is. (Task 1 test.)

---

### Task 1: `merge.ts`: `enrichPapers` + `keepCachedFields`

**Files:** create `src/lib/scholar/merge.ts` and `src/lib/scholar/merge.test.ts`

**Produces:**

```ts
export interface S2Enrichment {
  tldr?: string;
  abstract?: string;
}
/** Returns new Paper objects (inputs untouched), same order. */
export function enrichPapers(papers: Paper[], byDoi: Map<string, S2Enrichment>): Paper[];
/** `cached` is the jsonb `data` of an existing papers row (unknown shape). */
export function keepCachedFields(paper: Paper, cached: unknown): Paper;
```

- [ ] **1.1 Failing tests** (use a `paper(id, over)` helper like the one in `search.test.ts`):
  - `tldr` is set from the map.
  - `abstract` is filled when missing, and an existing abstract is kept.
  - Every other field is deep-equal to the input. The input objects are not mutated (freeze them).
  - A paper with no `doi`, or with a DOI not in the map, is returned unchanged.
  - Two papers sharing a DOI are both enriched.
  - An empty or whitespace-only `tldr`/`abstract` in the map is ignored.
  - `keepCachedFields` copies cached `tldr`/`abstract` only when the paper lacks them. A paper's own value wins.
  - `keepCachedFields` ignores `null`, an array, a string, and `{ tldr: 5 }`.
  - Run `pnpm vitest run src/lib/scholar/merge.test.ts`. Expect FAIL (module missing).
- [ ] **1.2 Implement.** Use `{ ...paper }` copies, and set fields only when there's a non-empty trimmed string.
- [ ] **1.3** Run the same command. Expect PASS.
- [ ] **1.4** Commit `feat(search): add s2 enrichment merge rules`.

### Task 2: `lookupSemanticScholarByDoi` (batch client)

**Files:** modify `src/lib/scholar/semanticscholar.ts`, `semanticscholar.test.ts` and `index.ts`

**Consumes:** `S2Enrichment` from `./merge`, plus `SemanticScholarError`, `SemanticScholarDeps`, `retryAfterMs`, `defaultSleep` and `clean` already in `semanticscholar.ts`.
**Produces:**

```ts
export function lookupSemanticScholarByDoi(
  dois: string[],
  deps?: SemanticScholarDeps,
): Promise<Map<string, S2Enrichment>>;
// index.ts: wrapper with the same signature that fills apiKey from serverEnv().SEMANTIC_SCHOLAR_API_KEY
```

- [ ] **2.1 Failing tests** (fake `fetch`, `sleep = vi.fn()`):
  - **Request:** `POST https://api.semanticscholar.org/graph/v1/paper/batch?fields=tldr,abstract`. The JSON body is `{ ids: ["DOI:10.1/a", "DOI:10.2/b"] }`, and the `x-api-key` header is present only with a key.
  - **No DOIs:** an empty list, or one that is all invalid (checked with `normaliseDoi`), returns an empty `Map` and never calls fetch.
  - **Duplicates:** duplicate and differently cased DOIs are sent once, lowercased.
  - **Mapping:** `[ {tldr:{text:"T"}, abstract:"A"}, null ]` maps to `10.1/a → {tldr:"T", abstract:"A"}`, and `10.2/b` is absent. `{ tldr: null }` gives no `tldr` key.
  - **Malformed responses:** a different-length array, a non-array or non-JSON body throws a 502, not retryable.
  - **429, then 200:** succeeds after one `sleep(500)`. A `Retry-After: 2` gives `sleep(2000)`. Two 429s throw `{status: 429, retryable: true}` after 2 fetches.
  - **400:** throws, not retryable, with 1 fetch and no key in the message.
  - **Abort:** an already-aborted signal makes no fetch; an abort during `sleep` gives no second fetch.
  - Run `pnpm vitest run src/lib/scholar/semanticscholar.test.ts`. Expect the new tests to FAIL.
- [ ] **2.2 Implement:**
  - a compact loop with `BATCH_BACKOFF_MS = [500]` and `Retry-After` capped at 2000 ms (inside the 3 s budget);
  - a per-attempt `AbortSignal.timeout(TIMEOUT_MS)` combined with `signal`;
  - the zod `z.array(z.union([z.null(), z.record(z.string(), z.unknown())]))` plus a length check;
  - `nonEmpty` for the text fields.

  Add the `index.ts` wrapper and exports.

- [ ] **2.3** Run the test file. Expect all PASS, including the SE-02 tests.
- [ ] **2.4** Commit `feat(search): add semantic scholar doi batch lookup`.

### Task 3: `searchPapers` enrich step

**Files:** modify `src/lib/scholar/search.ts` and `search.test.ts`

**Consumes:** nothing new (`enrich` is injected). **Produces:** `SearchDeps.enrich?: (papers: Paper[]) => Promise<Paper[]>`.

- [ ] **3.1 Failing tests:**
  - `enrich` receives the papers left after exclusion. Its output is what gets credibility and caching (cache receives papers with `tldr`).
  - The excluded set is re-checked after enrichment: with `exclude: ["survey"]` and an enriched abstract "a survey of…", that paper is dropped.
  - If `enrich` rejects, the page is the unenriched kept papers, `console.warn` is called once, and cache still runs.
  - If `enrich` resolves to `[]` or an array of a different length, its output is ignored and the unenriched page is used. (Enrichment must never drop papers.)
  - With no `enrich`, behaviour is the same as today (existing tests unchanged).
  - Run `pnpm vitest run src/lib/scholar/search.test.ts`. Expect FAIL.
- [ ] **3.2 Implement** in `searchPapers`: `const enriched = await safeEnrich(kept)`, then re-filter with `matchesExcluded`, then cache and credibility on the result.
- [ ] **3.3** Run the test file. Expect PASS.
- [ ] **3.4** Commit `feat(search): enrich search results before caching`.

### Task 4: route wiring + cache keeps S2 fields

**Files:** modify `src/app/api/search/route.ts` and `src/lib/scholar/cache.ts`

**Consumes:** `lookupSemanticScholarByDoi` (barrel), `enrichPapers` and `keepCachedFields`.

- [ ] **4.1 Route.** Pass `enrich: async (papers) => enrichPapers(papers, await lookupSemanticScholarByDoi(papers.flatMap((p) => (p.doi ? [p.doi] : [])), { signal: AbortSignal.any([request.signal, AbortSignal.timeout(3000)]) }))`. The 3 s signal is created inside the callback, so the budget starts when enrichment starts.
- [ ] **4.2 Cache.**
  - Before the upsert, `select("id, data").in("id", ids)`.
  - On success, map each paper through `keepCachedFields(paper, cachedById.get(paper.id))`. On a select error, continue with the papers as they are.
  - Remove the `TODO(SE-03)` comment.
- [ ] **4.3 Checks.** Run `pnpm check && pnpm build`. Expect both green.
- [ ] **4.4 End to end on the local stack** (`pnpm db:start`, then `pnpm dev` in the worktree):
  1. Make an anonymous sign-in via the Supabase REST API.
  2. Call `GET /api/search?q=social media adolescent mental health` with that session cookie.
  3. Expect 200 and at least one paper with `tldr`. Note the paper count.
  4. Check that `papers.data->>'tldr'` is set for those ids (a REST query with the service role key from `supabase status`, run as a script, never printed).
  5. **S2 down.** Restart dev with `SEMANTIC_SCHOLAR_API_KEY=invalid pnpm dev` (a real env var overrides `.env.local` in Next.js) and repeat step 2. Expect 200, the same paper count, an `[search] s2 enrichment skipped` warning in the dev log, and the TLDRs from step 4 still present in the `papers` rows.
  6. Restart dev normally.
- [ ] **4.5** Add an opt-in live test to `merge.test.ts` (`S2_LIVE=1`): look up 5 real DOIs and expect at least 1 TLDR, or accept a retryable 429.
- [ ] **4.6** Commit `feat(search): wire s2 enrichment into search and keep cached tldrs`.

### Task 5: review + local ship prep

- [ ] **5.1** Run the `pr-reviewer` agent (Opus) on `git diff origin/dev...HEAD`, with this plan's Review focus. Fix the Blockers and Should-fixes with tests that fail first.
- [ ] **5.2** `git fetch origin dev && git rebase origin/dev`, then `pnpm check && pnpm build`.
- [ ] **5.3** Draft the PR body. Give the user the push and PR steps, and remind them to **squash-merge** and to **push the checklist tick before merging**.
