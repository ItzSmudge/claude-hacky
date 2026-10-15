# SW-01 — Paper card: plan

Spec: `docs/specs/2026-10-15-sw-01-paper-card.md`

1. **Helpers (TDD)** — `src/components/swipe/card-format.test.ts` then `card-format.ts`; extend vitest `include` if needed. Check: `pnpm test` green.
2. **Popover primitive** — `src/components/ui/popover.tsx` via shadcn (no new dep). Check: `pnpm typecheck`.
3. **Credibility badge** — Popover, `/100`, "Low" label, metadata note. Files: `credibility-badge.tsx`. Check: typecheck + keyboard open in styleguide.
4. **Stance chip** — optional `claimText`/`note` → popover button with full accessible name. Files: `stance-chip.tsx`. Check: styleguide renders plain + interactive chips.
5. **Card** — use helpers, author in meta row, header rule, relevance label, "not stated" fallbacks. Files: `paper-card.tsx`. Check: deck page + styleguide in light/dark at 375px and desktop.
6. **Verify** — `pnpm check && pnpm build`; hex grep empty; a11y-reviewer + pr-reviewer; fix findings.
