# LB-01 — Library page: plan

Spec: `docs/specs/2026-10-16-lb-01-library-page.md`

1. **Grouping** (pure, test-first): `src/components/library/library-groups.ts`, with `groupByUse` and `groupByClaim`. Check: tests.
2. **Loader:** `loadSavedLibrary` also returns `claims` from `projects.context` (validated). Check: existing export tests still pass.
3. **UI:**
   - `saved-paper-card.tsx`: compact card with a remove/restore button;
   - `saved-paper-list.tsx`: client component with view tabs, sections, optimistic remove/restore through the swipes route, toasts, `router.refresh()`.
4. **Page:** render the list above `ExportPanel`.
5. **Verify:**
   - `pnpm check && pnpm build`;
   - local stack with the demo project: groups render, remove → restore works and exports update;
   - light and dark at mobile width (run-app skill screenshots);
   - `a11y-reviewer`.
