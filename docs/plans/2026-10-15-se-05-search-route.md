# SE-05 — `/api/search`: plan

Spec: `docs/specs/2026-10-15-se-05-search-route.md`

1. **Type filter in the OpenAlex client.** Update the URL tests. Check: scholar tests pass.
2. **`src/lib/scholar/search.ts`** with tests first: `parseExcludeTerms`, `matchesExcluded`, `searchPapers` (pass-through, credibility, exclude, cache, cache failure, errors). Check: tests pass.
3. **`src/lib/scholar/cache.ts`:** service-role upsert into `papers`.
4. **Route** `src/app/api/search/route.ts`: params → schema, auth, deadline, error mapping. Check: `pnpm check && pnpm build`.
5. **End-to-end on the local stack:**
   - anonymous sign-in → `GET /api/search?q=…` returns papers with credibility, and rows appear in `papers`;
   - without a session → 401;
   - bad params → 400.
