# SE-03 — Enrich search results with Semantic Scholar (TLDR, missing abstracts)

**Goal:** more swipe cards get S2's one-line **TLDR**, and cards whose OpenAlex record has no abstract get S2's. Both feed the AI analysis ([src/lib/ai/paper-analysis.ts](../../src/lib/ai/paper-analysis.ts)). `/api/search` stays exactly as it is for the deck: same ids, order, paging and response shape.

**Why DOI lookup, not merging two searches:** on 2026-10-16, two test queries' top 20 overlapped by only **5 and 2** papers between OpenAlex and S2 search. Looking up OpenAlex's own DOIs with S2 `/paper/batch` found **16/19 and 15/20**, with a TLDR for **10 and 12**. The checklist line's "prefer S2 TLDR, OpenAlex topics" holds; S2-only papers are out of scope (chosen with the user).

## Flow

`GET /api/search` (SE-05) changes in one place:

1. OpenAlex search (as today).
2. Drop excluded terms (as today).
3. **Enrich.** One `POST https://api.semanticscholar.org/graph/v1/paper/batch?fields=tldr,abstract`:
   - body `{ "ids": ["DOI:<doi>", …] }`, for the kept papers that have a DOI (≤ 50, since `perPage` ≤ 50);
   - the `x-api-key` header comes from env;
   - the response is an array aligned with `ids`, with `null` for unknown papers.
4. Credibility (as today, unchanged), then cache, then the response.

## Merge rules (`enrichPapers`, pure; only copies S2 data)

For an OpenAlex paper whose DOI S2 knows:

- `tldr` ← S2 `tldr.text`, when non-empty after whitespace cleanup.
- `abstract` ← S2 `abstract` **only if the paper has none**.
- Every other field stays OpenAlex's: `id`, title, authors, venue, year, citations, topics, URL, `isPeerReviewed`. Credibility is therefore unchanged.

Papers without a DOI, or that S2 doesn't know, are returned untouched. Order is preserved.

## Failure and time budget (best effort, never breaks search)

- **S2 budget: 3 s** for the whole lookup, on top of the route's existing 15 s deadline. The deck prefetches pages, so this is rarely visible.
- **Retries:** one retry after 429/5xx/network errors, with a 500 ms wait (or a `Retry-After` that fits the budget).
- On timeout, error, malformed body, a missing key or an S2 400: the page is returned **without enrichment** and one `console.warn` is logged (no key, no DOIs).
- The search response never fails because of S2.

## Cache (fixes `TODO(SE-03)` in `cache.ts`)

Before the upsert, `select id, data` for the page's ids. When the new paper lacks `tldr` or `abstract` but the cached row has it, keep the cached value. A later search during an S2 outage therefore doesn't erase TLDRs. If that `select` fails, upsert as today; it's still best effort.

## Units

- `lookupSemanticScholarByDoi(dois, deps)` in `src/lib/scholar/semanticscholar.ts` returns `Map<doi, { tldr?, abstract? }>`. It throws a `SemanticScholarError` on failure, and the caller swallows it.
- `enrichPapers(papers, lookup)` lives in a new `src/lib/scholar/merge.ts`.
- `SearchDeps.enrich?: (papers) => Promise<Paper[]>` in `search.ts`. The route wires S2 in with its own `AbortSignal.timeout(3000)`, combined with the request signal.
- The `index.ts` barrel fills the key from `serverEnv()`.

## Tests

- **Merge rules:** TLDR set; abstract only filled when missing; other fields untouched; no-DOI papers and unknown papers left alone.
- **Batch client:** URL, body and header; `null` entries; DOI normalisation; 429 then success; an empty DOI list makes no request; a malformed body.
- **`searchPapers`:** the enrich step runs after exclusion and before credibility and cache; a throwing or slow `enrich` still returns the page.
- **Cache merge:** cached `tldr`/`abstract` are kept when the new paper lacks them; a failing `select` still upserts.
- **Opt-in live test** (`S2_LIVE=1`) against real S2.

## Out of scope

- Union of OpenAlex and S2 search, and S2-only papers (SE-02's `searchSemanticScholar` stays available).
- Using S2 citation counts or venues.
- UI changes, and any change to `searchResponseSchema` or the contracts.
