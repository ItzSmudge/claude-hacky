# LB-03 — export formats: plan

Spec: `docs/specs/2026-10-15-lb-03-export-formats.md`. TDD for `src/lib/export`.

1. **`citeCommand` + LaTeX:** `src/lib/export/latex.ts` (+ test).
   - Tests:
     - item format, author truncation, missing fields, escaping
     - `\url` rules (the same as `verbatim`)
     - empty bibliography
     - every fixture item has balanced braces
   - Check: `pnpm vitest run src/lib/export`.
2. **CSV:** `src/lib/export/csv.ts` (+ test).
   - Tests: BOM, CRLF, quoting, formula neutralising, empty analysis columns, the header-only file.
3. **Markdown:** `src/lib/export/markdown.ts` (+ test).
   - Tests: section order and relevance sort, "Not analysed yet", markdown escaping, tag stripping, the empty list.
4. **Shared loader:** `src/lib/export/library.ts` (`loadSavedLibrary`).
   - Move the route's queries here and add `paper_analyses` (parsed with `paperAnalysisSchema`).
   - Route: dispatch every format, with each format's file extension and content type.
   - Check: `pnpm check`, then curl all 4 formats as the demo user.
5. **UI:** `src/components/library/export-panel.tsx` (client; holds `CopyCiteButton`) and `src/app/app/p/[projectId]/library/page.tsx`.
   - Server page: Suspense + `connection()`, loads via `loadSavedLibrary`, computes keys, renders the count, panel and empty state.
   - Check:
     - Playwright: light/dark and mobile screenshots
     - copy works (clipboard permission granted), with a toast
     - keyboard path
6. **Review:** run `pr-reviewer` + `a11y-reviewer`, fix the findings, run `pnpm check && pnpm build`, then ask before opening the PR.
