# SETUP_PLAN.md — Hackathon bootstrap for Claude Code

> **How to use this file:** put it in an empty repo root and tell Claude Code:
> "Read SETUP_PLAN.md and execute Phase 0–3 in order. Everything in §1 is decided; the only remaining placeholder is the domain (`example.com`)."
>
> App name: **PaperCut** (slug `papercut`). Domain placeholder: **`example.com`**.

---

## 1. Decisions & open questions

| # | Decision | Default (used unless changed) | Status |
|---|---|---|---|
| D1 | Package manager / runtime | pnpm (pinned via `packageManager` + corepack), Node 24 LTS (`.nvmrc`) | DEFAULT |
| D2 | Scholar index (source of truth for papers) | **OpenAlex** primary (free, no key, abstracts, topics, citation counts) + **Semantic Scholar** secondary (TLDRs, CS coverage) + **Crossref/doi.org** for BibTeX | DEFAULT |
| D3 | Perplexity Sonar | **Dropped.** Claude only ever summarises records retrieved from D2 | CONFIRMED |
| D4 | Auth | Supabase Auth: Google OAuth + **anonymous sign-in** so judges can try instantly; anon users can be upgraded later | CONFIRMED |
| D5 | App routing | Marketing at `example.com/`, app at `example.com/app/*` (one Vercel project, no subdomains besides `www` → apex redirect) | CONFIRMED |
| D6 | Claude models | `ANTHROPIC_MODEL_FAST=claude-haiku-5-5` for per-card analysis, `ANTHROPIC_MODEL_SMART=claude-sonnet-5-5` for brief parsing, insights, lit-review scaffold | DEFAULT |
| D7 | Repo visibility | **Private**, owned by Thomas's personal GitHub account. Branch rulesets on a private repo are only enforced if the owner has GitHub Pro (free via Student Developer Pack) — if not, rules are enforced by local hooks + CI + CLAUDE.md permissions instead | CONFIRMED |
| D8 | Vercel plan | **Hobby, production only.** Only `main` deploys (to `example.com`). No preview deployments, no shared Vercel env. Thomas owns Vercel and merges every `dev → main` release PR himself (Hobby blocks deploys from commits authored by non-owners on private repos) | CONFIRMED |
| D9 | Team ownership | Dev A = foundation then retrieval+AI, Dev B = swipe UI + adaptive ranking, Dev C = marketing + design system + a11y, Dev D = projects/briefs/library/exports/group | CONFIRMED – fill names |
| D10 | Local dev stack | Every dev runs Next.js + **local Supabase via the Supabase CLI (Docker)**. Schema/seed come from the repo, so all 4 stacks are identical. Hosted Supabase is used by production only | CONFIRMED |
| D11 | Design system | Teal `#035352` + cream `#F3E8BC`, full spec in §2b. Tokens land in Phase 0 so every agent builds on them from the first commit | CONFIRMED |
| D12 | Deadline | Fixed: **Fri 16 Oct 2026, 18:00 (London)**. Code freeze 17:00 | CONFIRMED |

---

## 2. Product summary (what we're building)

**Track:** Better Student Life (Claude hackathon, London).
**Pitch:** "Tinder for research papers." Tell it what you're writing; swipe through *real* papers; Claude explains in one line why each matters *for your assignment*; walk away with a clean, correct bibliography.

### Core loop
1. Create a **project** (= a research question / assignment). Optionally upload the coursework brief / marking rubric (PDF, DOCX, text).
2. Claude parses the brief once into a compact **project context**: topic, key claims/positions to test, required themes, constraints (e.g. date range).
3. Search query → retrieve candidates from OpenAlex/Semantic Scholar → normalise → dedupe by DOI.
4. For each paper, Claude (fast model) produces a **structured analysis from the retrieved title+abstract+metadata only**:
   - `overview` (≤ 35 words, simplified abstract)
   - `why_it_matters` (≤ 20 words, one line, relative to the brief)
   - `relevance` 0–100 + one-phrase reason
   - `stance` toward each key claim: `supports | challenges | neutral | unclear`
   - `methodology` and `limitations` (≤ 15 words each, "not stated in abstract" allowed)
   - `use_as`: `evidence | counterpoint | background | method`
5. **Credibility is computed, not generated**: citation count, venue type, peer-reviewed flag, recency → deterministic score shown with its inputs.
6. Swipe right = save, left = skip, up = details. Keyboard: ← → ↑, Space = read aloud.
7. **Library**: saved papers per project, persisted (fixes "papers disappear"), sidebar of past projects like a chat history.
8. **Exports**: BibTeX (`.bib`, fetched from doi.org content negotiation where DOI exists, otherwise built from metadata by code), LaTeX `thebibliography` block, CSV, Markdown reading list, "copy `\cite{key}`".
9. **Relations view** (on the saved set, not per card): Claude groups saved papers into supports / challenges / methods, flags complementary vs contrasting pairs — using only papers in the library.

### Differentiators (priority order)
- **P0 (must demo):** landing page, project + brief upload, search → analyse → swipe → save, history sidebar, BibTeX/CSV/LaTeX export, deployed on domain.
- **P1:** group sessions (shared swipe, compiled reading list, disagreement flags), adaptive swiping (re-rank + "I noticed you skip X" insight), relations view.
- **P2:** voice/a11y mode (TTS abstracts, voice commands), lit-review scaffold (outline with `\cite` keys validated against library), synthesis matrix export.

### Anti-hallucination rules (non-negotiable, also in CLAUDE.md)
- Claude never produces titles, authors, years, venues, DOIs, or BibTeX. All bibliographic data comes from retrieval APIs and is rendered by code.
- Claude output is JSON validated with zod; it references papers only by our internal `paper_id`. Any unknown id is dropped server-side.
- Prompts include "If the abstract doesn't say, answer `not stated`."
- Summaries have hard word limits enforced in the schema (fixes "too long/boring").

---

## 2b. Design system — colour palette & themes (single source of truth)

Every agent building UI reads this section (it is copied verbatim into `.claude/skills/design-system/SKILL.md` in Phase 0) and uses the **frontend-design** skill on top of it. No hex values in components: only the tokens below.

### Concept: "the reading room"
Scholarly but playful. Papers are **index cards** on a warm cream desk, written in deep teal ink. The swipe is the fun part; everything around it is calm, quiet and readable. Think library card catalogue meets a modern mobile app, not a SaaS dashboard.

### Brand colours
| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | **Ink Teal** | `#035352` | Primary buttons, links, headings on cream, active states, "save" stamp, logo |
| Secondary | **Parchment Cream** | `#F3E8BC` | Marketing section backgrounds, highlight surfaces, text/buttons on teal, dark-mode primary |

Contrast check: `#035352` on `#F3E8BC` ≈ **7.2:1** (passes WCAG AAA for body text). Teal on white ≈ 8.9:1. Both brand colours can carry text on each other in either direction.

### Extended scales (derived — use these, don't invent new shades)
| Step | Teal | Cream |
|---|---|---|
| 50 | `#EEF7F6` | `#FDFAF0` |
| 100 | `#D6ECEA` | `#FAF4DE` |
| 200 | `#A9D6D3` | **`#F3E8BC`** (brand) |
| 300 | `#74BAB7` | `#E9D894` |
| 400 | `#3F9C99` | `#DCC46A` |
| 500 | `#1A7F7C` | `#C9AB47` |
| 600 | `#0A6664` | `#A88A2E` |
| 700 | **`#035352`** (brand) | `#7F6821` |
| 800 | `#023F3E` | `#574716` |
| 900 | `#012C2B` | `#3A2F0E` |
| 950 | `#011D1C` | `#211A07` |

### Semantic colours (harmonised with the palette; never pure red/green)
| Token | Hex | Meaning |
|---|---|---|
| `supports` | `#2E7D4F` | Stance: supports / "use as evidence" |
| `challenges` | `#B5483B` | Stance: challenges / skip stamp / destructive |
| `neutral` | `#6B6F66` | Stance: neutral |
| `unclear` | `#6B6F66` + dashed border | Stance: unclear / "not stated" |
| `warning` | `#C9AB47` (cream-500) | Low credibility, rate-limit notices |
| `info` | `#3F9C99` (teal-400) | Tips, adaptive-ranking insight toast |

Stance is **never conveyed by colour alone**: every chip has an icon + label (`ThumbsUp Supports`, `Swords Challenges`, `Minus Neutral`, `HelpCircle Unclear`).

### Themes
**Light (default)**
- Page background `cream-50 #FDFAF0`; marketing alternates teal-700 bands and `#F3E8BC` bands.
- Cards (paper index cards) `#FFFDF7`, 1px border `cream-300`, soft warm shadow.
- Body text `teal-950 #011D1C`; muted text `teal-800` at 70% opacity; headings `teal-700`.
- Primary button: teal-700 bg, cream text. Secondary: `#F3E8BC` bg, teal-700 text. Ghost: teal-700 text.

**Dark** (respect `prefers-color-scheme`, toggle in app header)
- Background `teal-950 #011D1C`, cards `teal-900 #012C2B`, border `teal-800`.
- Text `#F3E8BC`; muted text cream at 65%.
- **Primary flips to cream**: `#F3E8BC` bg with teal-900 text.

**High-contrast** (a11y toggle, AX-04): text pure `teal-950` on `#FFFFFF`, borders 2px teal-700, no transparency, larger focus rings.

### Tokens — `src/app/globals.css` (Tailwind v4 + shadcn variables)
```css
:root {
  --brand-teal: #035352;
  --brand-cream: #F3E8BC;

  --background: #FDFAF0;
  --foreground: #011D1C;
  --card: #FFFDF7;
  --card-foreground: #011D1C;
  --popover: #FFFDF7;
  --popover-foreground: #011D1C;
  --primary: #035352;
  --primary-foreground: #F3E8BC;
  --secondary: #F3E8BC;
  --secondary-foreground: #035352;
  --muted: #FAF4DE;
  --muted-foreground: #3B5654;
  --accent: #D6ECEA;
  --accent-foreground: #023F3E;
  --destructive: #B5483B;
  --border: #E9D894;
  --input: #E9D894;
  --ring: #1A7F7C;
  --radius: 1rem;

  --supports: #2E7D4F;
  --challenges: #B5483B;
  --neutral: #6B6F66;
  --warning: #C9AB47;
  --info: #3F9C99;
}
.dark {
  --background: #011D1C;
  --foreground: #F3E8BC;
  --card: #012C2B;
  --card-foreground: #F3E8BC;
  --popover: #012C2B;
  --popover-foreground: #F3E8BC;
  --primary: #F3E8BC;
  --primary-foreground: #012C2B;
  --secondary: #023F3E;
  --secondary-foreground: #F3E8BC;
  --muted: #023F3E;
  --muted-foreground: #A9D6D3;
  --accent: #0A6664;
  --accent-foreground: #F3E8BC;
  --destructive: #D9705F;
  --border: #023F3E;
  --input: #023F3E;
  --ring: #74BAB7;

  --supports: #5FB585;
  --challenges: #E08A7C;
  --neutral: #A3A79C;
  --warning: #E9D894;
  --info: #74BAB7;
}
@theme inline {
  --color-brand-teal: var(--brand-teal);
  --color-brand-cream: var(--brand-cream);
  --color-supports: var(--supports);
  --color-challenges: var(--challenges);
  --color-neutral: var(--neutral);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --font-display: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
}
```
(Keep shadcn's existing `@theme inline` mappings for background/primary/etc.; add the lines above.)

### Typography (via `next/font/google`)
- **Display:** Fraunces (headings, paper titles on cards, marketing hero). Weight 600, tight tracking.
- **Body/UI:** Inter.
- **Mono:** JetBrains Mono for `\cite{}` keys, BibTeX previews, DOIs.
- Scale: hero `text-5xl md:text-7xl`, page title `text-3xl`, card title `text-xl` (max 3 lines, clamp), body `text-base`, meta `text-sm`. Body line-height 1.6; max reading width `65ch`.

### Shape, depth, spacing
- Radius: cards `rounded-2xl`, buttons/inputs `rounded-xl`, chips `rounded-full`.
- Shadow: one warm paper shadow token, e.g. `shadow-[0_8px_24px_-12px_rgba(3,83,82,0.25)]`; top card in deck slightly stronger. No hard black shadows.
- Spacing: 4px grid; card padding `p-6` (mobile `p-5`); page gutters `px-4 md:px-8`.
- Subtle paper texture allowed on marketing only (CSS noise, ≤ 4% opacity).

### Paper card anatomy (swipe deck)
Top → bottom: venue · year · credibility badge (row, `text-sm`, muted) → title (Fraunces) → **why it matters** (teal-700 on cream-200 highlight strip, one line) → overview (≤ 35 words) → stance chips → relevance bar (teal fill on cream track, number on the right) → "Details ↑" hint.

### Motion
- Library: `motion`. Swipe uses spring (stiffness ~300, damping ~30); card rotates max 12°.
- Drag right reveals a teal **SAVED** stamp; left reveals a terracotta **SKIP** stamp (rotated, outlined, Fraunces caps).
- Transitions 150–250ms ease-out for UI; no bouncing on anything except the deck.
- `prefers-reduced-motion`: no rotation/fling, cards fade; Save/Skip buttons always visible.

### Iconography & imagery
- `lucide-react`, stroke width 1.75, size 18–20px in UI.
- Illustrations (marketing only): simple flat line art in teal on cream (index cards, bookmarks, stacked papers). No stock photos, no purple/blue AI-gradient clichés.

### Voice & copy
Friendly, short, student-to-student. "Swipe right on research." "Every citation is real." Avoid jargon in UI labels ("Saved", not "Persisted"). Empty states give one clear next action.

### Do / Don't
- ✅ Use tokens only; check contrast for any new pairing; keyboard focus ring `ring-2 ring-ring ring-offset-2`.
- ❌ No new hex values, no pure `#000`/`#FFF` backgrounds (except high-contrast mode), no gradients other than teal-700 → teal-900, no more than one primary button per view.

---

## 3. Phase 0 — Repo, tooling, environment sync (Dev A, ~60–90 min, blocks everyone)

### 0.1 Scaffold
```bash
corepack enable
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
pnpm dlx shadcn@latest init
```
Install **everything we expect to need now** so later PRs rarely touch the lockfile:
```bash
pnpm add @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr zod motion lucide-react \
  clsx tailwind-merge sonner nanoid papaparse unpdf mammoth
pnpm add -D @commitlint/cli @commitlint/config-conventional husky lint-staged prettier \
  prettier-plugin-tailwindcss vitest @vitest/coverage-v8 supabase vercel @types/papaparse
```
shadcn components: `button card dialog sheet input textarea badge tabs tooltip dropdown-menu progress skeleton sonner avatar separator scroll-area`.

### 0.2 Version & dependency sync
- `.nvmrc` → `24`; `package.json`: `"engines": {"node": ">=24 <25"}`, `"packageManager": "pnpm@<version installed>"`.
- `.npmrc`: `engine-strict=true`, `auto-install-peers=true`.
- CI and every dev install with `pnpm install --frozen-lockfile`.
- `.editorconfig`, `.prettierrc` (with tailwind plugin), `.vscode/extensions.json` (eslint, prettier, tailwind, supabase) and `.vscode/settings.json` (format on save).
- **Dependency rule:** new packages only via a dedicated `chore(deps): add <pkg>` PR to `dev`, merged immediately, announced in team chat. Never mix dep changes into feature PRs (avoids lockfile conflicts across 4 devs × N agents).

### 0.3 Scripts (`package.json`)
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "format": "prettier --write .",
  "check": "pnpm lint && pnpm typecheck && pnpm test",
  "bootstrap": "bash scripts/bootstrap.sh",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local > src/types/database.ts",
  "db:push:prod": "supabase db push",
  "wt": "bash scripts/wt.sh",
  "prepare": "husky"
}
```

`scripts/bootstrap.sh` (what every teammate runs once after cloning; needs Docker running):
```bash
#!/usr/bin/env bash
set -euo pipefail
command -v nvm >/dev/null 2>&1 && nvm use || true
corepack enable
pnpm install --frozen-lockfile
command -v docker >/dev/null || { echo "❌ Docker is required for local Supabase"; exit 1; }
pnpm db:start                      # starts local Supabase, applies supabase/migrations + seed.sql
cp -n .env.example .env.local || true
# write local Supabase URL/keys into .env.local
node scripts/write-local-env.mjs   # reads `supabase status -o json`, fills NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY
echo "✅ Ready. Add your ANTHROPIC_API_KEY to .env.local, then: pnpm dev"
```

**Env sync without Vercel Pro:** the *shape* of env is synced through `.env.example` (committed) and validated by `src/lib/env.ts`; local Supabase values are generated by `write-local-env.mjs`, so they never need sharing. The only shared secret is the Anthropic key: share it once via a password manager / Bitwarden Send (never in Slack/Discord/git), or each dev uses their own key. Production secrets live only in Thomas's Vercel project.

### 0.4 Environment template — `.env.example` (committed; local defaults, prod values set in Vercel)
```dotenv
# ── App / routing ──────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=PaperCut
NEXT_PUBLIC_SITE_URL=http://localhost:3000        # prod (Vercel): https://example.com
NEXT_PUBLIC_APP_BASE_PATH=/app                    # app lives at example.com/app
APP_ENV=development                               # development | production

# ── Cloudflare (DNS + routing) — only needed by whoever runs scripts/cloudflare-dns.sh
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_TOKEN=                             # scoped: Zone.DNS:Edit on this zone only
CLOUDFLARE_DOMAIN=example.com                     # apex → Vercel production
CLOUDFLARE_WWW_HOSTNAME=www.example.com           # → redirects to apex (configured in Vercel)
CLOUDFLARE_PROXIED=false                          # keep false (grey cloud) in front of Vercel
VERCEL_DNS_TARGET=cname.vercel-dns.com            # confirm the value shown in Vercel → Domains

# ── Supabase — local values are written by scripts/write-local-env.mjs
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321   # prod: https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=                    # or the newer publishable key (sb_publishable_…)
SUPABASE_SERVICE_ROLE_KEY=                        # server only, never NEXT_PUBLIC
SUPABASE_PROJECT_REF=                             # prod only (Thomas), for db:push:prod
SUPABASE_DB_PASSWORD=                             # prod only (Thomas)

# ── Anthropic ─────────────────────────────────────────────────
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_FAST=claude-haiku-5-5
ANTHROPIC_MODEL_SMART=claude-sonnet-5-5

# ── Scholar sources ───────────────────────────────────────────
OPENALEX_MAILTO=team@example.com                  # polite pool
SEMANTIC_SCHOLAR_API_KEY=                         # request now; works without key at low rate
CROSSREF_MAILTO=team@example.com

# ── Feature flags ─────────────────────────────────────────────
NEXT_PUBLIC_FEATURE_GROUPS=true
NEXT_PUBLIC_FEATURE_ADAPTIVE=true
NEXT_PUBLIC_FEATURE_VOICE=false
```
Add `src/lib/env.ts` that parses `process.env` with zod (separate server/client schemas) and fails fast with a readable error.

`.gitignore` additions: `.env*.local`, `.env`, `.claude/worktrees/`, `.claude/settings.local.json`, `.vercel`.

### 0.5 Git rules
**Branches**
- `main` — production (`example.com`, the only thing Vercel deploys). Only receives PRs from `dev` (release) or `hotfix/*`. **Thomas merges these** so the merge commit is authored by the Vercel account owner (Hobby requirement).
- `dev` — integration, **set as the GitHub default branch** (so PRs and `claude --worktree` default to it). Not deployed; everyone tests it on their local stack after pulling.
- Work branches always cut from latest `origin/dev`: `feat/<scope>-<short-desc>`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `style/…`, `test/…`. `hotfix/*` cut from `main`, PR into `main`, then merge `main` back into `dev`.

**Commits — Conventional Commits** `type(scope): imperative summary` (≤ 72 chars, lowercase).
Types: `feat fix chore docs refactor style test perf build ci revert`.
Scopes (= workstreams): `marketing search ai swipe projects library export group ranking a11y design db infra deps contracts`.
Enforced with commitlint (`commit-msg` hook) + lint-staged (prettier/eslint on staged files, `pre-commit` hook).

**PRs**
- Feature → `dev`: squash merge; **PR title must be conventional** (it becomes the commit). CI must pass. 0 approvals required on `dev` (hackathon speed) but an agent review is required by process (see CLAUDE.md).
- `dev` → `main`: PR titled `chore(release): <summary>`, merge commit, 1 approval, CI green. Do this at milestones (e.g. every 2–3 hours, and before judging).
- Auto-delete head branches; disallow force-push and deletion on `main`/`dev`.
- `.github/pull_request_template.md`: checklist task IDs, link to spec + plan, what changed, screenshots/GIF for UI, how to test, "touched contracts/deps/db?" checkboxes.

`scripts/setup-github.sh` (uses `gh`): create `dev` from `main`, set default branch to `dev`, set merge settings (squash + merge commit, no rebase, delete branch on merge), add the 3 teammates as collaborators, create rulesets for `main` and `dev` as above, required status check `ci`. If the API reports rulesets aren't enforceable (private repo without GitHub Pro), print a warning and continue: enforcement then comes from the husky hooks, CI, and the `deny` rules in `.claude/settings.json` — Thomas should claim GitHub Pro via the Student Developer Pack if possible.

GitHub Actions minutes: private repos get a free monthly allowance; CI is kept to one fast job to stay well within it.

**CI** `.github/workflows/ci.yml` on PRs to `dev`/`main`: checkout → pnpm setup (version from `packageManager`) → node from `.nvmrc` → `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm build` (with dummy public env). Plus `amannn/action-semantic-pull-request` to validate PR titles.

### 0.6 Directory skeleton & contracts (critical for parallel work)
```
src/
  app/
    (marketing)/page.tsx            # landing             → owner: marketing
    (marketing)/layout.tsx
    app/                            # authenticated app   (D5)
      layout.tsx                    # shell + history sidebar → projects
      page.tsx                      # project list / new project → projects
      p/[projectId]/page.tsx        # swipe deck          → swipe
      p/[projectId]/library/page.tsx# saved + export      → library
      join/[code]/page.tsx          # group join          → group
    api/
      search/route.ts               # → search
      analyse/route.ts              # → ai
      projects/…                    # → projects
      export/[projectId]/route.ts   # → export
  components/ui/                    # shadcn (design)
  components/{marketing,swipe,library,projects,group,a11y}/
  lib/
    env.ts  supabase/{client,server}.ts
    scholar/{openalex,semanticscholar,crossref,normalize,index}.ts   # → search
    ai/{client,schemas,prompts,analyse-paper,project-context,insights}.ts # → ai
    ranking/                        # → ranking
    export/{bibtex,latex,csv}.ts    # → export
    credibility.ts                  # → search
  types/
    domain.ts                       # FROZEN CONTRACTS (see below)
    database.ts                     # generated
  fixtures/papers.json              # 20 realistic normalised papers + analyses for UI work
supabase/migrations/  supabase/seed.sql
docs/  (see Phase 2)
```

`src/types/domain.ts` — write these first; every stream codes against them:
```ts
export type PaperSource = "openalex" | "semanticscholar";
export interface Paper {
  id: string; source: PaperSource; externalId: string; doi?: string;
  title: string; abstract?: string; authors: { name: string }[];
  year?: number; venue?: string; url?: string; pdfUrl?: string;
  citationCount?: number; isPeerReviewed?: boolean;
  topics: string[]; tldr?: string;
}
export type Stance = "supports" | "challenges" | "neutral" | "unclear";
export interface PaperAnalysis {
  paperId: string; projectId: string;
  overview: string; whyItMatters: string;
  relevance: number; relevanceReason: string;
  stances: { claimId: string; stance: Stance; note: string }[];
  methodology: string; limitations: string;
  useAs: "evidence" | "counterpoint" | "background" | "method";
}
export interface Credibility { score: number; inputs: Record<string, number | string | boolean> }
export interface ProjectContext {
  topic: string; claims: { id: string; text: string }[];
  themes: string[]; constraints: string[]; summary: string;
}
export type SwipeDecision = "save" | "skip";
export interface Swipe { projectId: string; paperId: string; userId: string; decision: SwipeDecision; at: string }
```
Plus API route request/response zod schemas in `src/lib/api-schemas.ts`. Changing any contract = `chore(contracts): …` PR, merged fast, announced.

### 0.7 Supabase schema (first migration)
Tables (all with RLS on; access via project membership):
- `profiles(id → auth.users, display_name)`
- `projects(id, owner_id, title, query, context jsonb, join_code unique, created_at)`
- `project_members(project_id, user_id, role)`
- `project_documents(id, project_id, storage_path, filename, extracted_text, created_at)` + storage bucket `briefs` (private)
- `papers(id, source, external_id, doi, data jsonb, unique(source, external_id))` — cache
- `paper_analyses(project_id, paper_id, analysis jsonb, credibility jsonb, primary key(project_id, paper_id))`
- `swipes(project_id, paper_id, user_id, decision, created_at, primary key(project_id, paper_id, user_id))`
- Views: `reading_list` (papers with ≥1 save, with save/skip counts), `disagreements` (papers with both saves and skips)
- Enable Realtime on `swipes`.
- Enable anonymous sign-ins + Google provider in `supabase/config.toml` (local) and in the hosted dashboard (prod).
- `supabase/seed.sql`: a demo user, one demo project with context, and the fixture papers, so every local stack opens with data.
Then `pnpm db:reset && pnpm db:types`.
**Migration rule:** one migration PR at a time; after pulling a new migration everyone runs `pnpm db:reset`. Migrations reach prod only when Thomas runs `pnpm db:push:prod` as part of a release.

### 0.8 Deploy & domain
(Thomas only.)
1. Create the hosted Supabase project (prod), enable anonymous + Google auth, `pnpm db:push:prod`.
2. Vercel (Hobby, Thomas's account): import the private repo, Production branch = `main`. Set Production env vars only. Add `vercel.json` so nothing but `main` deploys:
   ```json
   { "git": { "deploymentEnabled": { "main": true, "*": false } } }
   ```
3. Vercel → Domains: add `example.com` (production) and `www.example.com` (redirect → apex).
4. Cloudflare DNS (`scripts/cloudflare-dns.sh`, reads `.env.local`, idempotent via the Cloudflare API): apex CNAME (flattened) → `VERCEL_DNS_TARGET`, `www` CNAME → same; **proxied=false**. If proxy is ever turned on, SSL mode must be Full (strict).
5. Supabase Auth (prod) → site URL `https://example.com`; redirect URLs `https://example.com/**`. Local config allows `http://localhost:3000/**` and `http://localhost:30*/**` (worktrees on other ports).
6. Smoke test on prod and on a fresh local stack: `/` renders, `/app` signs in anonymously, `/api/search?q=test` returns papers.

---

## 4. Phase 1 — Claude Code setup (shared, committed)

### 1.1 Plugins & skills — `.claude/settings.json`
```json
{
  "extraKnownMarketplaces": {
    "superpowers-marketplace": { "source": { "source": "github", "repo": "obra/superpowers-marketplace" } }
  },
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true,
    "frontend-design@claude-plugins-official": true
  },
  "permissions": {
    "allow": [
      "Bash(pnpm *)", "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
      "Bash(git add*)", "Bash(git commit*)", "Bash(git checkout*)", "Bash(git switch*)",
      "Bash(git fetch*)", "Bash(git pull*)", "Bash(git push origin feat/*)",
      "Bash(git push origin fix/*)", "Bash(git push origin chore/*)", "Bash(git push origin docs/*)",
      "Bash(git worktree*)", "Bash(gh pr *)", "Bash(supabase *)"
    ],
    "deny": [
      "Bash(git push --force*)", "Bash(git push origin main*)", "Bash(git push origin dev*)",
      "Read(./.env.local)", "Read(./.env)"
    ]
  }
}
```
Team plugin auto-install from project settings has been flaky; **every dev should also run once**:
```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
/plugin install frontend-design@claude-plugins-official
```
Verify with `/plugin` that both show enabled and `/superpowers:` commands autocomplete.

### 1.2 Worktrees (parallel agents without collisions)
- `.worktreeinclude` → `.env.local` (so worktrees get env vars).
- Default branch is `dev`, so `claude --worktree <name>` branches from `dev`. Its branch name is `worktree-<name>`, which breaks our naming rule, so **prefer the script**:

`scripts/wt.sh`:
```bash
#!/usr/bin/env bash
# usage: pnpm wt feat/swipe-gestures
set -euo pipefail
BR="$1"; DIR=".claude/worktrees/${BR//\//-}"
git fetch origin dev
git worktree add "$DIR" -b "$BR" origin/dev
cp -n .env.local "$DIR/.env.local" 2>/dev/null || true
(cd "$DIR" && pnpm install --frozen-lockfile)
echo "cd $DIR && claude"
```
- One task = one worktree = one branch = one PR. Remove with `git worktree remove <dir>` after merge.
- Next dev servers auto-pick the next free port; note the port in the PR if relevant.
- All worktrees on one machine share that machine's single local Supabase stack (Docker). Only the task that owns a migration should run `pnpm db:reset`; tell your other agents when you do.

### 1.3 Project skills (`.claude/skills/`)
- `claim-task/SKILL.md` — given a task ID: pull `dev`, mark it `[~] @<name> <branch>` in the checklist (via a tiny `docs(checklist)` commit straight on the task branch), create worktree via `pnpm wt`, then start the spec step.
- `ship-pr/SKILL.md` — run `pnpm check`, ensure checklist items ticked `[x]`, conventional commit, push, `gh pr create --base dev` with the template filled, title = conventional summary.
- `design-system/SKILL.md` — created in Phase 0 by copying §2b of this file verbatim (palette, tokens, themes, type, card anatomy, motion, voice, do/don't). Description: "Use for ANY UI work in this repo — colours, components, layout, copy." All UI agents load it together with `frontend-design`; the design owner (Dev C) may extend it but must not change the brand hexes.

### 1.4 Subagents (`.claude/agents/`)
- `pr-reviewer.md` — reviews a diff against CLAUDE.md: contracts untouched (or justified), no Claude-generated bibliographic data, zod on all LLM output, env via `lib/env.ts`, ownership boundaries, conventional title.
- `a11y-reviewer.md` — keyboard paths, focus, aria-live for swipe results, contrast, reduced-motion.

### 1.5 `CLAUDE.md` (root) — create with this content
```markdown
# PaperCut — agent guide

Hackathon project. Deadline is fixed: Fri 16 Oct 2026, 18:00 London time. Code freeze 17:00 (only fixes + demo prep after that; final release PR merged by 17:30). Ship working demos over perfect code.
Local stack: Next.js + local Supabase (Docker). Production: Vercel (main only) at example.com, app under /app.
Product + architecture: docs/architecture.md. Tasks: docs/checklists/. Contracts: src/types/domain.ts.

## Default workflow (every non-trivial task)
1. **Claim** a task in docs/checklists/ (`/claim-task <ID>`). Work only in its worktree/branch, cut from origin/dev.
2. **Spec** — superpowers brainstorming → `docs/specs/<YYYY-MM-DD>-<task-id>-<slug>.md`. Max ~1 page: goal, user flow, inputs/outputs, edge cases, out of scope.
3. **Plan** — superpowers writing-plans → `docs/plans/<same-name>.md`. Small steps, each with files touched and a check.
4. **Implement** — superpowers executing-plans / subagent-driven-development. TDD for pure logic in src/lib (scholar normalisers, ranking, exports, credibility). UI: build against src/fixtures first.
5. **Review** — superpowers requesting-code-review + the `pr-reviewer` subagent; UI also `a11y-reviewer` and a frontend-design pass. Fix findings, then verification-before-completion: `pnpm check && pnpm build` must pass.
6. **Ship** — `/ship-pr`: tick checklist items, PR into `dev`.
Skip 2–3 only for: typo/copy fixes, single-file bug fixes under ~30 lines, dep/chore PRs.

## Git
- Never commit or push to `main` or `dev`. Branch names: feat|fix|chore|docs|refactor|style|test/<scope>-<desc>.
- Conventional Commits: `type(scope): imperative summary`. Scopes: marketing search ai swipe projects library export group ranking a11y design db infra deps contracts.
- PR title = conventional commit (squash merged). Small PRs, merge often, rebase on origin/dev before opening.

## Hard rules
- **No invented scholarship.** Claude never outputs titles, authors, years, venues, DOIs, URLs or BibTeX. Bibliographic data comes only from OpenAlex/Semantic Scholar/Crossref and is rendered by code. LLM output references papers by internal id only; unknown ids are discarded.
- All LLM output is JSON validated by zod schemas in src/lib/ai/schemas.ts. Enforce word limits. Missing info → "not stated".
- Credibility is computed in src/lib/credibility.ts, never by the model.
- Models come from ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL_SMART. Use prompt caching for project context.
- Env only via src/lib/env.ts. Never put secrets in code, logs, or NEXT_PUBLIC vars.
- Stay inside your workstream's owned paths (listed in its checklist). Need a change elsewhere? Note it in the PR or open a separate small PR.
- src/types/domain.ts and api-schemas are frozen: changes need a `chore(contracts)` PR, merged immediately.
- No new dependencies in feature PRs — open `chore(deps)` PR instead.
- DB changes only as new files in supabase/migrations + `pnpm db:types`; one migration PR at a time.
- `dev → main` release PRs are merged by Thomas only (Vercel Hobby deploys require it).

## Design (consistency across all agents)
- Load the `design-system` skill + `frontend-design` before any UI work. Palette: Ink Teal #035352 (primary) and Parchment Cream #F3E8BC (secondary), with the derived scales and semantic tokens defined there.
- Use tokens/Tailwind classes only (`bg-primary`, `text-foreground`, `bg-brand-cream`, `text-supports`…). Never hard-code hex values or add new colours.
- Fonts: Fraunces (display), Inter (UI), JetBrains Mono (cite keys/BibTeX). Cards = paper index cards, `rounded-2xl`, warm shadow.
- Light + dark themes must both work; stance never shown by colour alone; respect reduced motion.
- shadcn components only for primitives; must work on mobile (judges test on phones) and with keyboard.

## Commands
pnpm dev | pnpm check | pnpm build | pnpm wt <branch> | pnpm db:start | pnpm db:reset | pnpm db:types
```

---

## 5. Phase 2 — Docs & parallel checklists

Create:
```
docs/
  README.md                 # how to claim/update tasks, status legend, ownership map
  architecture.md           # §2 of this file + data flow diagram (mermaid) + API list
  specs/.gitkeep
  plans/.gitkeep
  checklists/
    00-foundation.md
    01-marketing.md
    02-search.md
    03-ai.md
    04-swipe.md
    05-projects.md
    06-library-export.md
    07-group.md
    08-ranking.md
    09-a11y-voice.md
    10-release-demo.md
```
**Legend:** `[ ]` open · `[~] @name branch` in progress · `[x]` done (PR #) · `[!]` blocked (reason).
Each checklist starts with: **Owner**, **Owned paths**, **Depends on**, **Can start with fixtures?**. Task IDs like `SW-03` so specs/plans/PRs can reference them. Within a checklist, tasks marked ⚡ are independent and can run as parallel agents.

### 00-foundation.md (blocking — Dev A; others set up machines meanwhile)
- [ ] F-01 Scaffold + deps (§0.1) · F-02 Version/sync files (§0.2) · F-03 Scripts + bootstrap (§0.3)
- [ ] F-04 `.env.example` + `lib/env.ts` · F-05 Husky/commitlint/lint-staged · F-06 CI + PR template
- [ ] F-07 `setup-github.sh` (dev default, rulesets) · F-08 Directory skeleton + `domain.ts` + `api-schemas.ts`
- [ ] F-09 `fixtures/papers.json` (20 realistic papers incl. analyses; use real OpenAlex results)
- [ ] F-10 Supabase local config + migration + seed + types + anon auth + `write-local-env.mjs`
- [ ] F-11 Hosted Supabase + Vercel (main only) + domains + Cloudflare script + prod smoke test (Thomas)
- [ ] F-12 `.claude/` settings, skills (incl. design-system from §2b), agents, `.worktreeinclude`, `wt.sh`, CLAUDE.md
- [ ] F-13 Placeholder pages for every route so streams don't collide on routing
- [ ] F-14 Design tokens from §2b in `globals.css`, fonts via `next/font`, dark-mode toggle, themed shadcn primitives, `/app/_styleguide` page showing palette, type, buttons, chips, a sample paper card
**Exit criteria:** teammate can clone → `pnpm bootstrap` → `pnpm dev` (seeded data, themed styleguide renders) → `pnpm wt feat/x` → open PR that passes CI.

### 01-marketing.md — Owner Dev C — `src/app/(marketing)`, `components/marketing`, `.claude/skills/design-system`
- [ ] MK-01 Review F-14 styleguide with frontend-design; extend the design-system skill (illustration style, empty states, marketing section patterns) without changing brand hexes
- [ ] MK-02 ⚡ Hero on teal-700 band with cream type: "Swipe right on research" + animated demo card stack (fixture data) + CTA "Try it — no signup" → `/app`
- [ ] MK-03 ⚡ How it works (3 steps), feature grid (brief-aware, real citations, group mode, accessible)
- [ ] MK-04 ⚡ Trust section: "Every citation is real" — explain retrieval-only
- [ ] MK-05 ⚡ OG image, favicon, metadata, mobile polish

### 02-search.md — Owner Dev A — `lib/scholar`, `lib/credibility.ts`, `app/api/search`
- [ ] SE-01 ⚡ OpenAlex client (search, abstract inverted-index → text, topics, cited_by_count, type) + tests
- [ ] SE-02 ⚡ Semantic Scholar client (search, TLDR) + tests, graceful 429 handling
- [ ] SE-03 Normaliser + DOI dedupe + merge (prefer S2 TLDR, OpenAlex topics)
- [ ] SE-04 ⚡ Credibility function + tests
- [ ] SE-05 `/api/search` with project filters (year range, exclude terms) + cache to `papers`

### 03-ai.md — Owner Dev A (second agent) — `lib/ai`, `app/api/analyse`
- [ ] AI-01 ⚡ Anthropic client wrapper (model env, retries, JSON-only, zod parse with one repair retry)
- [ ] AI-02 ⚡ Brief → `ProjectContext` (PDF sent as document block; DOCX via mammoth; text) using SMART model
- [ ] AI-03 Paper analysis prompt + schema (word limits, stance per claim, "not stated"); prompt-cache project context
- [ ] AI-04 `/api/analyse` batch endpoint: analyse next N papers in parallel, stream results so the deck never waits
- [ ] AI-05 Relations analysis over saved set (supports/challenges/methods, complement/contrast pairs; ids only)
- [ ] AI-06 Eval script: 10 fixture papers → check no fabricated fields, lengths respected

### 04-swipe.md — Owner Dev B — `components/swipe`, `app/app/p/[projectId]/page.tsx`
- [ ] SW-01 ⚡ Card component (title, venue/year, overview, why-it-matters, relevance bar, stance chips, credibility badge with tooltip of inputs)
- [ ] SW-02 ⚡ Gesture deck with `motion` (drag, fling thresholds, undo last), keyboard ← → ↑ Z
- [ ] SW-03 Detail sheet (full abstract, methodology, limitations, links)
- [ ] SW-04 Queue state: prefetch/analyse 3 ahead, skeletons, empty/"load more" states
- [ ] SW-05 Persist swipes to Supabase; optimistic UI
- [ ] SW-06 Mobile polish + reduced-motion fallback (buttons)

### 05-projects.md — Owner Dev D — `components/projects`, `app/app/page.tsx`, `app/app/layout.tsx`, `app/api/projects`
- [ ] PR-01 ⚡ New project flow: question/task text + optional brief upload → storage → AI-02 → show parsed claims (editable)
- [ ] PR-02 ⚡ History sidebar (past projects, counts), rename/delete
- [ ] PR-03 Anonymous session → optional Google upgrade

### 06-library-export.md — Owner Dev D — `components/library`, `lib/export`, `app/api/export`, library page
- [ ] LB-01 ⚡ Library page: saved papers grouped by `useAs` / stance, remove/restore
- [ ] LB-02 ⚡ BibTeX: doi.org content negotiation → fallback code-built entry; stable cite keys (`lastnameYEARword`) + tests
- [ ] LB-03 ⚡ LaTeX `thebibliography` + `.bib` download + "copy \cite{}" ; CSV ; Markdown reading list
- [ ] LB-04 Relations view UI (consumes AI-05)

### 07-group.md — Owner Dev D (after 05/06) — `components/group`, `app/app/join`
- [ ] GR-01 Join code + invite link; join adds `project_members`
- [ ] GR-02 Realtime presence ("3 people swiping") + live swipe feed
- [ ] GR-03 Compiled reading list (save counts) + disagreement flags with quick "discuss/resolve"

### 08-ranking.md — Owner Dev B (after SW-05) — `lib/ranking`
- [ ] RK-01 ⚡ Feature extraction per paper (topics, keywords from title, year bucket, venue type) + tests
- [ ] RK-02 ⚡ Online weights from swipes (simple +/− per feature with decay); re-rank queue after ≥ 6 swipes
- [ ] RK-03 Insight toast: SMART model turns top negative/positive features into one sentence ("You keep skipping survey papers — hide them?") with one-tap apply → adds filter
- [ ] RK-04 Group mode: rank by combined weights

### 09-a11y-voice.md — Owner Dev C (after marketing) — `components/a11y`
- [ ] AX-01 ⚡ Keyboard + screen-reader pass on deck (aria-live announcements of save/skip, focus management)
- [ ] AX-02 ⚡ Read-aloud: Web Speech `speechSynthesis` for overview/abstract, rate control
- [ ] AX-03 Voice commands (`SpeechRecognition` where supported): "save", "skip", "read", "why does it matter"
- [ ] AX-04 High-contrast / large-text toggle

### 10-release-demo.md — whole team
- [ ] RD-01 `dev → main` release PRs at milestones (P0 done, P1 done, final)
- [ ] RD-02 Seed a polished demo project (real brief + query) on prod
- [ ] RD-03 Demo script (2 min): problem → upload brief → swipe 5 → group joins from phone → disagreement → export LaTeX
- [ ] RD-04 Stretch P2: lit-review scaffold (outline with `\cite` keys validated against library)
- [ ] RD-05 README, screenshots, submission form

### Suggested timeline
- T+0–1.5h: Foundation (Dev A; Thomas does F-11). Others: install Docker, Node 24, pnpm, Claude Code plugins, read CLAUDE.md + §2b, write specs for their first tasks against fixtures.
- T+1.5–6h: P0 streams in parallel (02/03, 04, 01, 05/06). First release to `main` at end.
- T+6–10h: P1 (07, 08, LB-04). Release.
- Remaining: polish, a11y/voice, demo.
- **Hard stops (Fri 16 Oct):** 14:00 no new P1/P2 features started · 16:00 last feature PR into `dev` · 17:00 code freeze (fixes only) · 17:30 final `dev → main` release merged by Thomas, prod smoke-tested · 18:00 submission.

---

## 6. Phase 3 — Verification before handing off
- [ ] Fresh clone on a second machine: `pnpm bootstrap && pnpm dev` works with seeded data and the themed `/app/_styleguide` (light + dark).
- [ ] `pnpm wt feat/test-branch` creates worktree with env; a dummy PR to `dev` passes CI; direct push to `dev`/`main` is blocked (ruleset, or Claude deny rules if rulesets unavailable).
- [ ] A non-conventional commit message is rejected locally; non-conventional PR title fails CI.
- [ ] Pushing to `dev` triggers no Vercel deployment; merging to `main` deploys.
- [ ] `example.com`, `example.com/app`, and `www` → apex redirect all serve HTTPS.
- [ ] `grep -rE "#[0-9a-fA-F]{6}" src/components src/app --include=*.tsx` returns nothing (no hard-coded colours).
- [ ] `/plugin` shows superpowers + frontend-design enabled.
- [ ] All checklists exist with owners filled in; post the ownership table in team chat.
