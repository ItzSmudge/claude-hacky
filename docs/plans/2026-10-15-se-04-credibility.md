# SE-04 — Credibility score: plan

Spec: `docs/specs/2026-10-15-se-04-credibility.md`

1. **Tests first.** Write `src/lib/credibility.test.ts`: each component, missing data, venue detection, bounds, determinism, and fixture sanity (a heavily cited review outscores an uncited conference abstract; stored fixture scores match the function). Check: tests fail.
2. **Implement** `src/lib/credibility.ts`. Check: tests pass.
3. **Regenerate fixtures.** Write `scripts/regenerate-credibility.mjs`, which rewrites only `credibility` in `src/fixtures/papers.json` using a fixed `now` (2026-10-15). Then run `node scripts/generate-seed.mjs`. Check: the diff touches only credibility values.
4. **Verify.** Check: `pnpm check && pnpm build`.
