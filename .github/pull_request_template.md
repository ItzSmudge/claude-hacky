## What & why

<!-- One or two sentences. PR title must be a conventional commit: type(scope): summary -->

**Checklist task IDs:** <!-- e.g. SW-01, SW-02 -->
**Spec:** docs/specs/… **Plan:** docs/plans/…

## What changed

-

## Screenshots / GIF (UI changes)

<!-- Light + dark, mobile width if layout changed -->

## How to test

1. `pnpm db:reset` (if migrations changed)
2. `pnpm dev` → …

## Touches shared things?

- [ ] Contracts (`src/types/domain.ts`, `src/lib/api-schemas.ts`) — must be a `chore(contracts)` PR
- [ ] Dependencies / lockfile — must be a `chore(deps)` PR
- [ ] Database (`supabase/migrations`) — ran `pnpm db:types`, announced in chat
- [ ] None of the above

## Done

- [ ] `pnpm check && pnpm build` pass locally
- [ ] Checklist items ticked `[x]` in `docs/checklists/`
- [ ] Reviewed by `pr-reviewer` agent (+ `a11y-reviewer` for UI)
- [ ] No hard-coded hex colours; no Claude-generated bibliographic data
