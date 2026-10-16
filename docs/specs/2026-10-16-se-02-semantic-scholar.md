# SE-02 — Semantic Scholar client

**Goal:** a tested `searchSemanticScholar()` in `src/lib/scholar`, with the same shape as the OpenAlex client (SE-01). It returns `Paper`s with S2's one-line **TLDR**. SE-03 will merge these with OpenAlex results. A 429 must never break search: S2's anonymous pool is often saturated (6/6 anonymous searches answered 429 when this spec was written, with no `Retry-After`).

## Flow

SE-03 (not this task) calls `searchSemanticScholar({ q, yearFrom, yearTo, page, perPage })`:

1. `GET https://api.semanticscholar.org/graph/v1/paper/search`
   - `query`, `offset = (page-1)·perPage`, `limit = perPage`
   - `year` as `from-to`, `from-` or `-to`
   - `fields=paperId,externalIds,title,abstract,year,venue,publicationVenue,publicationTypes,authors,citationCount,openAccessPdf,tldr,url,fieldsOfStudy`
2. Header `x-api-key` when `SEMANTIC_SCHOLAR_API_KEY` is set. The barrel in `index.ts` fills it from `serverEnv()`. The key never goes in the URL, errors or logs.
3. Validate the body with zod: `{ total, data: [...] }`. Map each result with `s2PaperToPaper` and drop the unusable ones.
4. Return `{ papers, total, nextPage }`, the same type as `OpenAlexSearchResult`.

## Mapping (every field copied from S2; nothing invented)

| `Paper`            | From S2                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `id`               | `semanticscholar-<paperId>`, `source: "semanticscholar"`, `externalId: paperId`                                   |
| `doi`              | `externalIds.DOI` → `normaliseDoi` → lowercase                                                                    |
| `title`            | `title`, whitespace collapsed. Results with no `paperId` or title are dropped.                                    |
| `abstract`, `tldr` | `abstract`; `tldr.text`                                                                                           |
| `authors`          | `authors[].name`                                                                                                  |
| `year`, `venue`    | `year` (integer); `publicationVenue.name ?? venue`                                                                |
| `citationCount`    | `citationCount` (integer ≥ 0)                                                                                     |
| `url`              | `https://doi.org/<doi>` if there is a DOI, else S2 `url` (http(s) only)                                           |
| `pdfUrl`           | `openAccessPdf.url` (http(s) only; S2 sends `""` when there is none)                                              |
| `topics`           | `fieldsOfStudy`, first 3                                                                                          |
| `isPeerReviewed`   | `publicationTypes` ∩ {JournalArticle, Conference, Review} **and** `publicationVenue.type` ∈ {journal, conference} |

Optional fields are left unset (not `undefined`/`""`), as in SE-01.

## Errors and limits

`SemanticScholarError { status, retryable }`, mirroring `OpenAlexError`:

- **429 / 5xx / network / body-read failures:** 2 retries (500 ms, 1.5 s), honouring `Retry-After` capped at 5 s. After that, a retryable error, which SE-03 treats as "use OpenAlex only".
- **Other 4xx or malformed body:** not retried (400 / 502). One exception: the first 400 is retried once, straight away, without `tldr` in `fields`, as a safety net in case S2 restricts that field (search accepted it on 2026-10-16, with a key).
- **Empty query:** rejected without a request.
- 8 s timeout per attempt. The caller's `AbortSignal` cancels both waits and requests.
- `perPage` is clamped to 1–100. S2 serves only the first 1,000 results: the last page's `limit` is shrunk so offset + limit ≤ 1,000, pages past that return empty without a request, and `nextPage` is `null` once `page·perPage ≥ min(total, 1000)`.

## Tests

Recorded fixture `__fixtures__/semanticscholar-papers.json`:

- the real S2 record for `10.1016/j.chb.2020.106645`, the same paper as `openalex-W3110709293` in `src/fixtures`;
- synthetic edge cases, clearly labelled.

The tests check mapping, `paperSchema` validity, the URL and header, paging, and every error path above, with injected `fetch`/`sleep`.

## Out of scope

- Merging and DOI dedupe with OpenAlex (SE-03), and wiring into `/api/search`.
- Batch TLDR lookup (`/paper/batch`). Confirmed 2026-10-16: search returns `tldr`, but it is `null` for some papers (about 2 in 5 in a sample of 5); those papers simply have no TLDR.
- Getting an API key. That needs a request to S2; it is recommended, because anonymous use is mostly 429s.
