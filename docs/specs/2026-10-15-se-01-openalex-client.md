# SE-01 — OpenAlex client

## Goal

Fetch candidate papers from OpenAlex and turn each work into our frozen `Paper` shape. This is the first real source of papers. SE-03 merges it with Semantic Scholar, and SE-05 wraps it in `/api/search`. Every bibliographic field comes straight from OpenAlex; nothing is invented or guessed.

## User flow

There's no UI. SE-05 calls `searchOpenAlex({ q, yearFrom, yearTo, page, perPage })` and gets back `Paper`s whose ids are `openalex-W…`, the same scheme as the fixtures, so the deck, swipes and the `papers` cache work unchanged.

## Inputs / outputs (`src/lib/scholar/openalex.ts`)

- **`abstractFromInvertedIndex(index) → string | undefined`** (pure)
  - Puts every word at each of its positions, joins with spaces and collapses whitespace.
  - Gaps in the positions are skipped. A `null` or empty index gives `undefined`.
- **`workToPaper(work) → Paper | null`** (pure)
  - `id` is `openalex-<W id>` and `externalId` is the W id, both taken from `https://openalex.org/W…`.
  - `doi` has its `https://doi.org/` prefix removed and is lowercased.
  - `title` is `display_name` with HTML tags (`<i>`, `<sub>`) stripped and whitespace collapsed. If there's no title, the work is dropped (`null`).
  - `authors` come from `authorships[].author.display_name`, in order, skipping empty names.
  - `year` is `publication_year`, and `venue` is `primary_location.source.display_name`.
  - `url` is the doi.org link, otherwise the landing page, otherwise the OpenAlex page. `pdfUrl` is `best_oa_location.pdf_url`.
  - `citationCount` is `cited_by_count`.
  - `isPeerReviewed` is true when `type` is `article` or `review` and the source type is `journal`.
  - `topics` are up to 3 `topics[].display_name` values, falling back to `primary_topic`.
  - `abstract` comes from `abstractFromInvertedIndex`. `tldr` is left unset (that's Semantic Scholar's job, SE-02).
  - Works that are retracted, are paratext (covers, indexes) or have no id are dropped.
- **`searchOpenAlex(params, { fetch?, mailto?, signal? }) → { papers, total, nextPage }`**
  - Sends `GET https://api.openalex.org/works` with `search`, `page`, `per-page` (at most 50) and a `select=` list of only the fields above.
  - Adds `filter=publication_year:<from>-<to>` (either end may be open), and always `mailto` from `env.OPENALEX_MAILTO` when it's set.
  - Retries `429` and `5xx` up to 2 times, honouring `Retry-After` and otherwise backing off 0.5 s then 1.5 s. Any request takes at most 8 s, and it respects the caller's `signal`.
  - On final failure or a malformed body, it throws `OpenAlexError` (`{ status, retryable }`); SE-05 decides how to degrade. `nextPage` is `null` once `page * perPage >= total`.
  - `fetch` is injected for tests (the same pattern as LB-02's `fetchDoiBibtex`).

## Edge cases

- **Odd works:** works with no abstract, no authors, no venue or no DOI (preprints, books) still come through with those fields left unset, never "not stated".
- **Abstracts:** inverted indexes with repeated words and non-ASCII text map correctly. OpenAlex sometimes truncates abstracts, and we keep what it returns.
- **Queries:** search terms are URL-encoded. A query containing `,` or `|` can't corrupt `filter`, because the query only ever goes in `search`.
- **Paging:** an empty result gives `papers: []` and `nextPage: null`.

## Tests (vitest, no network)

- Pure functions run against hand-trimmed real OpenAlex work JSON in `src/lib/scholar/__fixtures__/` (fixture paper W3110709293, plus a retracted work and a work with no abstract).
- `searchOpenAlex` runs against a fake `fetch` and covers: the URL and params, `mailto`, the year filter, retry then success on 429, `Retry-After`, giving up with `OpenAlexError`, and `nextPage` maths.

## Out of scope

- Semantic Scholar (SE-02), DOI dedupe and merging (SE-03), credibility (SE-04).
- Exclude terms, caching to `papers`, and the `/api/search` route (SE-05).
- An OpenAlex API key, and cursor paging past page 50 (we only need the first few pages for the deck).
