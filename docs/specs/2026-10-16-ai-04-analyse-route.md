# AI-04 — `/api/analyse` batch endpoint

**Goal:** the deck asks for the next few papers and gets each card's analysis as soon as it's ready, without waiting for the slowest one. Every analysis is saved per project, so it's generated once and reused by every member, by reloads and by the library.

**Depends on:**

- AI-03 `analysePaper()`, PR #30. Code starts after it merges.
- SE-05, the `papers` cache.
- Contracts already in `src/lib/api-schemas.ts`: `analyseRequestSchema`, `analyseStreamEventSchema`.

## API

`POST /api/analyse`, with a JSON body `{ projectId: uuid, paperIds: string[1..10] }`.

| Case                                                             | Response                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Not signed in (anonymous sessions count as signed in)            | 401 `ApiError`                                                                                             |
| Invalid body                                                     | 400 `ApiError`                                                                                             |
| Project not visible to the user (not a member, or doesn't exist) | 404 `ApiError`                                                                                             |
| Otherwise                                                        | `200 application/x-ndjson`, one `AnalyseStreamEvent` per line, in completion order, then `{"type":"done"}` |

The stream events are:

- `{"type":"analysis","analysis":PaperAnalysis}`
- `{"type":"error","paperId","error":"<short user-facing message>"}`

## Flow

1. **Auth and parse.** As in `/api/search`: `getSupabaseServerClient()`, `getClaims()`, then zod. Duplicate `paperIds` are collapsed.
2. **Project.** Select `context, title, query` with the user's RLS client. No row means 404.
   - If `context` is null (no parsed brief yet; AI-02 isn't done), fall back to `{ topic: title, summary: query, claims: [], themes: [], constraints: [] }`. The deck then works without a brief, with an empty stance list.
3. **Already analysed.** Select `paper_analyses` rows for `(projectId, paperIds)` and emit each valid one straight away, with no model call. A row that fails `paperAnalysisSchema` is treated as missing and re-analysed.
4. **Papers.** For the rest, read the `papers` cache rows. Any signed-in user can read them; `data` holds a `Paper`. An id that isn't cached gets `error: "Paper not found"`.
5. **Analyse in parallel.** Call `analysePaper()` for each remaining paper, with at most 5 at a time.
   - The signal is `AbortSignal.any([request.signal, timeout(55 s)])`.
   - Each result is emitted as soon as it resolves.
6. **Save.** Upsert `paper_analyses { project_id, paper_id, analysis, credibility: computeCredibility(paper) }` with the user's client (members have insert/update policies).
   - A save failure is logged, and the analysis is still emitted.
   - Credibility comes from code (`src/lib/credibility.ts`), never from the model.
7. **Done.** Emit `done` and close. If the client disconnects, the abort stops outstanding model calls.

## Per-paper error messages

| Cause                                  | Event `error` message           | Server log                                       |
| -------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `AiOutputError` / `AiRefusalError`     | "Couldn't summarise this paper" | Class only                                       |
| SDK rate limit / 5xx / timeout / abort | "AI is busy — try again"        | —                                                |
| `AiConfigError`                        | "AI isn't configured"           | Logged once per request; the key is never logged |
| Anything else                          | "Analysis failed"               | `console.error`                                  |

## Structure (testable without network or DB)

- `src/lib/ai/analyse-batch.ts`: `analyseBatch({ projectId, paperIds, context, deps, signal })` returns an `AsyncIterable<AnalyseStreamEvent>`.
  - `deps = { loadExisting, loadPapers, analyse, save }`. Concurrency, ordering and error mapping live here.
  - Unit-tested with fakes: cached rows first, a missing paper, an error that doesn't stop the others, a save failure, `done` last, at most 5 in flight.
- `src/app/api/analyse/route.ts`: auth, parse, project lookup, Supabase-backed deps, and an NDJSON `ReadableStream`. Covered by a route test with the Supabase and `analysePaper` modules mocked: 401, 400, 404, and the happy-path stream.
- Client side: SW-04 (#32) already reads the stream with `src/components/swipe/analyse-stream.ts`, so no client reader ships here.

## Edge cases

- All ids are already analysed: no model calls, an instant stream.
- One paper hangs: the others still stream, and the hung one gets the timeout error before `done`.
- Two members ask for the same paper at once: both may analyse it, and the upsert keeps the last result. That's acceptable.
- Vercel: `export const maxDuration = 60` on the route. Next 16 still supports it with Cache Components on; only `dynamic`/`revalidate`/`fetchCache` were removed.

## Out of scope

- Deck integration, prefetching 3 ahead and skeletons (SW-04).
- Choosing which papers come next (SW-04 / RK-02).
- Brief parsing (AI-02).
- Contract or migration changes.
