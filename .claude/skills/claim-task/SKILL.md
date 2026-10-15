---
name: claim-task
description: Claim a PaperCut checklist task by ID (e.g. /claim-task SW-02) — marks it in progress in docs/checklists, creates its worktree + branch from origin/dev, then starts the spec step. Use at the start of every task.
---

# Claim a task

Argument: a task ID such as `SW-02` (and optionally your name; otherwise use `git config user.name`).

1. **Find it.** `grep -rn "<ID>" docs/checklists/`. Stop if the line is already `[~]` or `[x]` — tell the user who has it.
   Check the checklist header's **Depends on**; if a dependency isn't `[x]`, say so and ask whether to proceed with fixtures.
2. **Pick a branch name**: `<type>/<scope>-<short-desc>` where scope is the checklist's workstream
   (marketing search ai swipe projects library export group ranking a11y design db infra). Lowercase, hyphens.
3. **Create the worktree**: `pnpm wt <branch>` (fetches origin/dev, creates `.claude/worktrees/<branch>`, copies `.env.local`, installs). Work only inside that directory from now on.
4. **Mark it claimed** in the worktree: change `- [ ] <ID>` to `- [~] @<name> <branch> <ID>` in its checklist, then
   `git commit -m "docs(checklist): claim <ID>"`, then `git push -u origin <branch>` so teammates see the claim.
   (Cross-check: `git fetch && git log origin/dev -- docs/checklists` if two people may race.)
5. **Start the spec step** — invoke `superpowers:brainstorming` and write `docs/specs/<YYYY-MM-DD>-<id>-<slug>.md` (≤ 1 page: goal, user flow, inputs/outputs, edge cases, out of scope).
   For UI tasks load the `design-system` and `frontend-design` skills first. Build against `src/fixtures` until the real API exists.

Skip the spec/plan only for typo/copy fixes, single-file bug fixes under ~30 lines, and dep/chore PRs.
