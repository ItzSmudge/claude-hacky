# SE-02 — Semantic Scholar client: plan

> **For agentic workers:** use superpowers:executing-plans (or subagent-driven-development) task by task. Steps use `- [ ]`.

**Goal:** a `searchSemanticScholar()` that returns validated `Paper`s (with TLDR) and handles 429s gracefully.
**Architecture:** one new module, `src/lib/scholar/semanticscholar.ts`, built like `openalex.ts`: a pure mapper, then a fetch loop with injected `fetch`/`sleep`/`signal`, then a barrel wrapper that adds the env key. It is not wired into `/api/search` (that's SE-03).
**Tech:** TypeScript, zod 4, vitest 5. No new dependencies.
**Spec:** `docs/specs/2026-10-16-se-02-semantic-scholar.md`

## Global constraints

- Every bibliographic field is copied from the S2 response. Nothing is invented or filled in by default.
- Contracts are frozen: use `Paper` from `@/types/domain` as it is. Output must pass `paperSchema` from `@/lib/api-schemas`.
- `process.env` is read only via `serverEnv()` in `index.ts`. The API key goes only in the `x-api-key` header, never in a URL, error message or log.
- Stay in owned paths: `src/lib/scholar/**`, plus this task's docs and checklist line.
- Retries: 2 (500 ms, 1500 ms), `Retry-After` capped at 5000 ms, 8000 ms timeout per attempt, `perPage` 1–100 (default 20), result window 1000.

## Review focus (inputs the spec implies but doesn't spell out)

1. **Zero results.** S2 can omit `data` when `total` is 0. That should return `{ papers: [], total: 0, nextPage: null }`, not a "malformed" error. (Task 2 test.)
2. **Hyphenated queries.** S2 says hyphenated terms match nothing ("self-esteem"), so replace `-` with a space in `query`. (Task 2 test.)
3. **`Retry-After` as an HTTP date or garbage.** Ignore it and use the normal backoff. Never wait more than 5 s. (Task 2 test.)
4. **Messy records.** Null entries in `authors`, a non-integer `year`, a DOI in URL or upper-case form, `openAccessPdf: { url: "" }` and a `tldr` with no text should each be dropped or normalised quietly, never crash. (Task 1 tests.)
5. **The key must not leak.** The request URL never contains it, and the error message on a 403 doesn't include it. (Task 2 test.)

---

### Task 1: fixture + `s2PaperToPaper`

**Files:** create `src/lib/scholar/__fixtures__/semanticscholar-papers.json`, `src/lib/scholar/semanticscholar.ts`, `src/lib/scholar/semanticscholar.test.ts`

**Produces:**

```ts
export interface S2Paper {
  paperId?: string | null;
  externalIds?: { DOI?: string | null } | null;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  publicationVenue?: { name?: string | null; type?: string | null } | null;
  publicationTypes?: string[] | null;
  authors?: ({ name?: string | null } | null)[] | null;
  citationCount?: number | null;
  openAccessPdf?: { url?: string | null } | null;
  tldr?: { text?: string | null } | null;
  url?: string | null;
  fieldsOfStudy?: string[] | null;
}
export function s2PaperToPaper(p: S2Paper): Paper | null;
```

- [ ] **1.1 Record the fixture.** `GET https://api.semanticscholar.org/graph/v1/paper/DOI:10.1016/j.chb.2020.106645?fields=<spec fields>` (works anonymously). Save the response, unedited, as `papers.real`, with a `_note` like the OpenAlex fixture. Add synthetic records `noTitle`, `noId`, `sparse` (no DOI/abstract/tldr/venue, `openAccessPdf: { url: "" }`, `publicationTypes: null`), `messy` (null author, `year: 2020.5`, DOI as `https://doi.org/10.1/ABC`, `tldr: { text: null }`, 5 `fieldsOfStudy`, `url: "javascript:x"`), and `preprint` (`publicationTypes: ["JournalArticle"]`, `publicationVenue.type: "repository"`). Give synthetic ids a `9000…` prefix.
- [ ] **1.2 Failing tests:**
  - `real` maps to a `Paper` with `id: "semanticscholar-4dbdefe3d0f5ccae521c12b80a7d666932dc504b"`. Its `doi`, `title`, `authors`, `year` and `citationCount ≥ 0` agree with the `openalex-W3110709293` fixture's doi/title/year. `tldr` is set, `isPeerReviewed` is true, `topics` comes from `fieldsOfStudy`, and `url` is `https://doi.org/10.1016/j.chb.2020.106645`.
  - `noTitle` and `noId` give `null`.
  - `sparse` has no `doi`/`abstract`/`tldr`/`venue`/`pdfUrl` properties (check with `not.toHaveProperty`), `url` is the S2 url, `isPeerReviewed` is false.
  - `messy`: authors without the null; no `year`; `doi === "10.1/abc"`; no `tldr`; 3 topics; `url` is the DOI link (falls back to S2 `url` only without a DOI, and a `javascript:` url is never used).
  - `preprint` is not peer reviewed.
  - every fixture that isn't null passes `paperSchema.parse`.
  - Run `pnpm vitest run src/lib/scholar/semanticscholar.test.ts`. Expect FAIL (module missing).
- [ ] **1.3 Implement** the mapper, copying `clean`/`nonEmpty`/`httpUrl` locally from `openalex.ts`. Use `normaliseDoi` from `@/lib/export/doi`. Venue is `publicationVenue.name ?? venue`. Peer reviewed means types ∩ {JournalArticle, Conference, Review} **and** venue type ∈ {journal, conference}. Set optional fields only when they're present, as in `workToPaper`.
- [ ] **1.4** Run the same command. Expect PASS.
- [ ] **1.5** Commit `feat(search): map semantic scholar papers`.

### Task 2: `searchSemanticScholar` (request, paging, errors)

**Files:** modify `src/lib/scholar/semanticscholar.ts` and `semanticscholar.test.ts`

**Consumes:** `s2PaperToPaper`. **Produces:**

```ts
export class SemanticScholarError extends Error { constructor(message: string, readonly status: number, readonly retryable: boolean) }
export interface SemanticScholarSearchParams { q: string; yearFrom?: number; yearTo?: number; page?: number; perPage?: number }
export interface SemanticScholarDeps { fetch?: Fetch; apiKey?: string; signal?: AbortSignal; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> }
export function searchSemanticScholar(params: SemanticScholarSearchParams, deps?: SemanticScholarDeps): Promise<OpenAlexSearchResult>
```

(`OpenAlexSearchResult` is `import type` from `./openalex`, so SE-03 gets one result type.)

- [ ] **2.1 Failing tests** (fake `fetch` returning `Response`s, `sleep` as `vi.fn()`):
  - **URL:** `query` (hyphens → spaces), `offset=(page-1)·perPage`, `limit`, `fields` = the spec list, and `year` as `2018-2022` / `2018-` / `-2022`, with swapped bounds reordered.
  - **Key:** `x-api-key` header present when `apiKey` is given and absent otherwise; the key never appears in the URL.
  - **Paging:** `nextPage` is 2 when `total` is 50, perPage 20, page 1. It is `null` at the 1000 cap (page 50, perPage 20, total 5000). `perPage` 500 becomes `limit=100`.
  - **Mapping:** maps `real` and drops `noTitle`. Zero results without `data` give an empty page.
  - **Empty or whitespace query:** throws `SemanticScholarError` (400, not retryable) and never calls fetch.
  - **429 (`Retry-After: 2`), then 429 (no header), then 200:** `sleep` is called with 2000, then 1500. A date or garbage `Retry-After` uses the backoff. `Retry-After: 60` gives a 5000 ms wait.
  - **Three 429s:** throws status 429, `retryable: true`, and fetch is called 3 times.
  - **400 / 403:** no retry, not retryable, message has no key.
  - **Malformed JSON:** 502, not retryable.
  - **Network error, then 200:** succeeds. A body-read failure is retried.
  - **Abort:** an already-aborted signal throws without fetching; aborting during `sleep` stops the retries.
  - Run the test file. Expect FAIL.
- [ ] **2.2 Implement:**
  - Mirror the loop in `searchOpenAlex`: per-attempt `AbortSignal.timeout(8000)` combined with the caller's signal; `retryAfterMs`; `defaultSleep`.
  - zod schema: `z.object({ total: z.number().int().nonnegative(), data: z.array(z.record(z.string(), z.unknown())).optional() })`.
  - `nextPage = page*perPage < Math.min(total, 1000) ? page+1 : null`.
- [ ] **2.3** Run the test file. Expect PASS.
- [ ] **2.4** Commit `feat(search): add semantic scholar search with 429 backoff`.

### Task 3: barrel + full checks

**Files:** modify `src/lib/scholar/index.ts`

- [ ] **3.1** Export `SemanticScholarError`, `s2PaperToPaper`, `type S2Paper`, and a wrapper `searchSemanticScholar(params, deps = {})` that fills `apiKey: deps.apiKey ?? serverEnv().SEMANTIC_SCHOLAR_API_KEY`. Same pattern as the `searchOpenAlex` wrapper.
- [ ] **3.2** Run `pnpm check && pnpm build`. Expect both green.
- [ ] **3.3 Opt-in live test.** In `semanticscholar.test.ts`, add `describe.skipIf(!process.env.S2_LIVE)("live", …)`. It calls the real API ("social media adolescent mental health", 2018–2022, `apiKey: process.env.SEMANTIC_SCHOLAR_API_KEY`) and accepts either papers that pass `paperSchema` or a retryable 429 `SemanticScholarError`. It is skipped in `pnpm check` and CI. Run it with `S2_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/scholar/semanticscholar.test.ts`. Expect a pass, and log the count and one title/`tldr`. **If S2 answers 400 for the `tldr` field,** remove `tldr` from the fields, update the URL test, and note it in the PR.
- [ ] **3.4** Commit `feat(search): export semantic scholar client`.

### Task 4: review + local ship prep (no push)

- [ ] **4.1** Run the `pr-reviewer` agent on `git diff origin/dev...HEAD` and fix Blockers and Should-fixes.
- [ ] **4.2** `git fetch origin dev && git rebase origin/dev`, then `pnpm check`.
- [ ] **4.3** Leave the checklist line `[~]`. Give the user the push and `gh pr create` commands plus a filled PR body.
