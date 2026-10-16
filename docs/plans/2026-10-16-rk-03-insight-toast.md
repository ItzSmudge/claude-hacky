# RK-03 plan — Insight toast

1. `src/lib/ranking/insight.ts` + tests: `findInsight`, `templateSentence`, `applyDeckFilters`. Check: `pnpm test insight`.
2. `src/lib/ai/schemas.ts` `insightOutputSchema`; `src/lib/ai/insight.ts` `phraseInsight` + tests (prompt contents, schema). Check: `pnpm test ai/insight`.
3. `src/app/api/ranking/insight/route.ts` + route test (auth, body, member, 502). Check: `pnpm test ranking/insight`.
4. Wire into `persisted-swipe-deck.tsx`: toast, filters state + localStorage, chips. Check: `pnpm check && pnpm build`.
5. Review (pr-reviewer + a11y-reviewer), fix, tick RK-03, ship.
