# PaperCut docs

- `SETUP_PLAN.md` — the original bootstrap plan (decisions, design system, phases).
- `architecture.md` — product summary, data flow, tables, API + route ownership.
- `checklists/` — every task, by workstream. **This is the team's task board.**
- `specs/`, `plans/` — one spec + one plan per non-trivial task: `<YYYY-MM-DD>-<task-id>-<slug>.md`.

## Claiming and updating tasks

1. `/claim-task <ID>` in Claude Code (or by hand): change `- [ ] <ID>` to `- [~] @<name> <branch> <ID>`, commit `docs(checklist): claim <ID>` on your task branch and push it.
2. Work in that branch's worktree (`pnpm wt <branch>`).
3. `/ship-pr`: tick it `- [x] <ID> (PR #12)` in the same PR.
4. Blocked? `- [!] <ID> (blocked: reason)` and say so in team chat.

Tasks marked ⚡ inside a checklist are independent and can run as parallel agents.

## Status legend

`[ ]` open · `[~] @name branch` in progress · `[x]` done (PR #) · `[!]` blocked (reason)

## Ownership map

| Checklist         | Owner                     | Owned paths                                                                                         |
| ----------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| 00-foundation     | Dev A (+ Thomas for F-11) | repo root config, `scripts/`, `.github/`, `.claude/`, `supabase/`                                   |
| 01-marketing      | Dev C                     | `src/app/(marketing)`, `src/components/marketing`, `.claude/skills/design-system`                   |
| 02-search         | Dev A                     | `src/lib/scholar`, `src/lib/credibility.ts`, `src/app/api/search`                                   |
| 03-ai             | Dev A (second agent)      | `src/lib/ai`, `src/app/api/analyse`                                                                 |
| 04-swipe          | Dev B                     | `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`                                        |
| 05-projects       | Dev D                     | `src/components/projects`, `src/app/app/page.tsx`, `src/app/app/layout.tsx`, `src/app/api/projects` |
| 06-library-export | Dev D                     | `src/components/library`, `src/lib/export`, `src/app/api/export`, library page                      |
| 07-group          | Dev D                     | `src/components/group`, `src/app/app/join`                                                          |
| 08-ranking        | Dev B                     | `src/lib/ranking`                                                                                   |
| 09-a11y-voice     | Dev C                     | `src/components/a11y`                                                                               |
| 10-release-demo   | whole team                | —                                                                                                   |

Replace "Dev A–D" with names once D9 is filled in, and post this table in team chat.
