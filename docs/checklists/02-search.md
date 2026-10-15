# 02 — Search

**Owner:** Dev A
**Owned paths:** `src/lib/scholar`, `src/lib/credibility.ts`, `src/app/api/search`
**Depends on:** F-08, F-10
**Can start with fixtures?** Yes — fixtures show the target `Paper` shape (`src/fixtures/papers.json`)

- [~] @Mr-Moody feat/search-openalex-client SE-01 ⚡ OpenAlex client (search, abstract inverted-index → text, topics, cited_by_count, type) + tests
- [ ] SE-02 ⚡ Semantic Scholar client (search, TLDR) + tests, graceful 429 handling
- [ ] SE-03 Normaliser + DOI dedupe + merge (prefer S2 TLDR, OpenAlex topics)
- [ ] SE-04 ⚡ Credibility function + tests (replace the placeholder formula used to build fixtures, then regenerate them)
- [ ] SE-05 `/api/search` with project filters (year range, exclude terms) + cache to `papers` (service-role client)

Notes: OpenAlex rate-limits anonymous search under load — send `mailto`, back off on 429, consider a free API key. Paper ids in fixtures are `openalex-<W id>`; keep that scheme.
