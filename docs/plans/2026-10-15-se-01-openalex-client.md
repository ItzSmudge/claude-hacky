# SE-01 — OpenAlex client: plan

Spec: `docs/specs/2026-10-15-se-01-openalex-client.md`. TDD throughout, no network in tests.

1. **Recorded works** — `src/lib/scholar/__fixtures__/openalex-works.json`
   - Hand-trimmed real OpenAlex `/works` records:
     - W3110709293 (matches `src/fixtures`)
     - a retracted work
     - a paratext work
     - a preprint with no abstract, venue or DOI
     - a title with `<i>` markup
   - Check: the JSON parses.
2. **Abstract rebuild** — `abstractFromInvertedIndex` in `src/lib/scholar/openalex.ts` (+ `openalex.test.ts`)
   - Tests:
     - word order
     - repeated words
     - gaps
     - non-ASCII text
     - `null` and `{}` give `undefined`
     - the fixture abstract starts with "Social media have become"
   - Check: `pnpm vitest run src/lib/scholar`.
3. **Mapping** — `workToPaper(work)`
   - `doi` reuses `normaliseDoi` from `src/lib/export/doi.ts` (import only), then lowercases.
   - Tests:
     - W3110709293 maps to a `Paper` equal to the `src/fixtures` record for id, externalId, doi, title, authors, year, venue, url, citationCount, isPeerReviewed and topics
     - retracted works, paratext works and works with no title give `null`
     - the preprint keeps its optional fields unset and has `isPeerReviewed: false`
     - HTML is stripped from titles
     - `url` falls back to the landing page and then the OpenAlex page
     - every output passes `paperSchema`
   - Check: vitest.
4. **Search** — `searchOpenAlex(params, deps)` and `OpenAlexError`
   - `deps` is `{ fetch, mailto, signal, sleep }`, so tests can make backoff instant.
   - Tests:
     - URL: `search`, `page`, `per-page` capped at 50, `select`, `mailto`
     - the year filter: both ends, one end, none
     - a query with `,|&` stays in `search`
     - 429 then 200 succeeds, with `Retry-After` honoured
     - 3 × 503 throws `OpenAlexError` with `retryable: true`
     - 400 throws immediately without retrying
     - a malformed body throws
     - `nextPage` maths and an empty result
     - the abort signal is passed through
   - Check: vitest.
5. **Barrel** — `src/lib/scholar/index.ts` exports the public API. `mailto` defaults to `serverEnv().OPENALEX_MAILTO` only when `deps.mailto` is undefined, so the tests never read the env.
6. **Verify**
   - `pnpm check && pnpm build`.
   - A live smoke test is left for a machine with network access (`api.openalex.org` is blocked in the cloud sandbox), noted in the PR.
