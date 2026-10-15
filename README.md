# claude-hacky

hi lads
helloooo
we are claude

## PaperCut — getting started

"Tinder for research papers": swipe through real papers, see why each matters for your assignment, export a correct bibliography.

Prereqs: Node 24 (`nvm install` / `fnm use`), Docker running, `gh` CLI, Claude Code with the superpowers + frontend-design plugins.

```bash
pnpm bootstrap   # install, start local Supabase (migrations + seed), write .env.local
pnpm dev         # http://localhost:3000 — /app, /app/_styleguide
pnpm wt feat/<scope>-<desc>   # new task worktree from origin/dev
```

Read `CLAUDE.md`, then pick a task in `docs/checklists/` (`/claim-task <ID>`). Architecture: `docs/architecture.md`.
