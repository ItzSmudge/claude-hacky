# SE-05 — `/api/search`

**Goal:** `GET /api/search` returns real papers with credibility for the swipe deck. The SW-04 queue already calls it, and the frozen `searchRequestSchema`/`searchResponseSchema` define its shape.

## Flow

The deck (SW-04) calls `GET /api/search?q=…&projectId=…&page=…`. The route:

1. Validates the request with zod.
2. Requires a signed-in user (anonymous sessions count).
3. Runs `searchPapers`:
   - OpenAlex search (SE-01) with year filters
   - drops papers matching any `exclude` term
   - `computeCredibility` (SE-04)
   - upserts the kept papers into `papers` (service role)
4. Returns `{ papers, nextPage }`.

## Inputs / outputs

- **Query:** `q` (required, ≤ 300), `page`, `perPage` (≤ 50), `yearFrom`, `yearTo`, `exclude` (repeated and/or comma-separated; lowercased, deduped, ≤ 20 terms of ≤ 80 chars), `projectId` (validated; unused for now).
- **Exclude** matches whole words, case-insensitive, in the title, abstract or topics. Regex characters are literal.
- **Cache:** rows are `{ id, source, external_id, doi, data: Paper, updated_at }`, upserted on `id`. Swipes and analyses reference `papers.id`, so a swipe on an uncached paper fails.
- **Search filters:** OpenAlex now always filters to readable work types (article, review, conference-paper, preprint, book-chapter, book, dissertation, report). This drops datasets and "Additional file 1 of …" supplementary files.

## Errors

| Case                                 | Response                             |
| ------------------------------------ | ------------------------------------ |
| Invalid params                       | 400 with zod details                 |
| Not signed in                        | 401                                  |
| OpenAlex 429/5xx/unreachable/aborted | 503 `Retry-After: 5`                 |
| OpenAlex other 4xx or malformed      | 502                                  |
| Cache write fails                    | Results still returned; error logged |

The whole request has a 15 s deadline, which also aborts if the client disconnects.

## Out of scope

Semantic Scholar merge (SE-02/03), project-stored filters (`projectId` is reserved), response caching.
