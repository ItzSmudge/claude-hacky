---
name: ship-pr
description: Ship the current PaperCut task branch as a PR into dev — runs checks, ticks the checklist, pushes, and opens a PR with the template filled and a conventional title. Use when a task is implemented and reviewed.
---

# Ship a PR

1. **Verify** (superpowers:verification-before-completion): `pnpm check && pnpm build`. Fix anything red — never ship red.
   UI changes: `grep -rE "#[0-9a-fA-F]{6}" src/components src/app --include=*.tsx` must print nothing.
2. **Review**: run the `pr-reviewer` agent on `git diff origin/dev...HEAD` (plus `a11y-reviewer` for UI). Fix findings or note why not.
3. **Tick the checklist**: change `- [~] @name branch <ID>` to `- [x] <ID> (PR #?)` — fill the number after step 6 with a follow-up commit if needed.
4. **Rebase** on latest dev: `git fetch origin dev && git rebase origin/dev`, re-run `pnpm check` if anything changed.
5. **Commit + push**: conventional commits only (`type(scope): imperative summary`, ≤ 72 chars, lowercase). `git push -u origin <branch>` (never main/dev, never force-push a shared branch).
6. **Open the PR**:
   ```bash
   gh pr create --base dev --title "<type>(<scope>): <summary>" --body-file <filled .github/pull_request_template.md>
   ```
   Title = the squash commit, so it must be conventional. Body: task IDs, spec + plan links, what changed, screenshots for UI (light + dark), how to test, shared-things checkboxes.
7. Post the PR link back to the user. Don't merge it yourself unless asked; `dev → main` releases are merged by ItzSmudge (repo + Vercel owner) only.
