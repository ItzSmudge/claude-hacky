# 00 — Foundation (blocking)

**Owner:** Dev A; Thomas for F-11
**Owned paths:** repo root config, `scripts/`, `.github/`, `.claude/`, `supabase/`, `src/types`, `src/lib/{env,api-schemas}.ts`, `src/lib/supabase`, `src/fixtures`
**Depends on:** —
**Can start with fixtures?** n/a

- [x] F-01 Scaffold + deps (§0.1) — Next 16.4, Tailwind 4, shadcn radix-nova + 16 components
- [x] F-02 Version/sync files (§0.2) — Node 24, pnpm via corepack, `.npmrc`, editorconfig, prettier, VS Code
- [x] F-03 Scripts + bootstrap (§0.3)
- [x] F-04 `.env.example` + `lib/env.ts`
- [x] F-05 Husky/commitlint/lint-staged
- [x] F-06 CI + PR template
- [~] F-07 `setup-github.sh` (dev default, rulesets) — script written; Thomas to run it
- [x] F-08 Directory skeleton + `domain.ts` + `api-schemas.ts`
- [x] F-09 `fixtures/papers.json` (20 real OpenAlex papers + analyses)
- [x] F-10 Supabase local config + migration + seed + types + anon auth + `write-local-env.mjs`
- [ ] F-11 Hosted Supabase + Vercel (main only) + domains + Cloudflare script + prod smoke test (Thomas)
- [x] F-12 `.claude/` settings, skills (incl. design-system from §2b), agents, `.worktreeinclude`, `wt.sh`, CLAUDE.md
- [x] F-13 Placeholder pages for every route
- [x] F-14 Design tokens, fonts, dark-mode toggle, themed primitives, `/app/_styleguide`

**Exit criteria:** teammate can clone → `pnpm bootstrap` → `pnpm dev` (seeded data, themed styleguide renders) → `pnpm wt feat/x` → open PR that passes CI.
