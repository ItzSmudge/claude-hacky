# LB-04 plan — Relations view

1. **Pure resolver (TDD).** `src/components/library/relations.ts`: `resolveRelations(relations, papers, claims)`
   → `{ debated, oneSided, methods, pairs }` with paper refs. Drop unknown ids, methods with < 2 known
   papers, and pairs with an unknown side. Test: `relations.test.ts` against
   `src/lib/ai/__fixtures__/relations.json` plus an injected unknown id. Check: `pnpm test relations`.
2. **Panel.** `src/components/library/relations-panel.tsx` (client): idle → loading → result | error,
   zod-parse the response, live status, Refresh. Tokens only, `rounded-2xl` card, stance icon + label.
   Check: `pnpm typecheck`.
3. **Wire up.** `src/app/app/p/[projectId]/library/page.tsx`: render between the list and export when
   there are ≥ 2 papers, passing code-made paper refs. Check: `pnpm check && pnpm build`.
4. **Review.** pr-reviewer + a11y-reviewer, fix findings, tick LB-04, ship.
