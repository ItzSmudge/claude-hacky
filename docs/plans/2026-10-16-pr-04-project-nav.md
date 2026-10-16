# PR-04 Project nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared project header (title, invite/presence, Deck · Library (n) · Group tabs with a live saved count) on every `/app/p/[projectId]` page.

**Architecture:** A new route layout renders the title + `ProjectInvite` + a client `ProjectTabs`. The tabs pick the active tab from the layout segment and keep the Library count fresh via a realtime channel that triggers a debounced recount. Pages drop their duplicated headers.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), Supabase JS + realtime, Tailwind v4 tokens, lucide-react, vitest.

**Spec:** `docs/specs/2026-10-16-pr-04-project-nav.md`

## Global Constraints

- Tokens/Tailwind classes only — no hex values in `.tsx`; lucide icons `strokeWidth={1.75}`, `aria-hidden`.
- Anything reading `params`, cookies or uncached data sits inside `<Suspense>`; call `await connection()` before Supabase server reads.
- Tap targets `min-h-11`; focus ring `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden`; `hc:` 2px borders; motion respects `motion-reduce`.
- Copy: tabs "Deck", "Library", "Group"; count read as "Library, 7 saved"; summary "7 papers saved" / "1 paper saved".
- No new dependencies; no migrations.

## Review Focus

- 320px-wide phone with a 90-character title: title wraps, tabs stay three equal columns, no horizontal scroll (manual check, Task 4).
- Undo right after a save: count goes back down (DELETE recount) — manual check, Task 4.
- Two rapid swipes: one recount, not two racing ones; a late, older response must not overwrite a newer one — `countSaved` + request-sequence guard in Task 2.
- Non-uuid project id (`/app/p/demo`): layout renders demo title, count hidden, no Supabase call — Task 3.
- Keyboard: Tab reaches the three tabs in order, active one exposes `aria-current="page"` — manual check, Task 4.

---

### Task 1: `countSaved` helper

**Files:**

- Create: `src/components/projects/saved-count.ts`
- Test: `src/components/projects/saved-count.test.ts`

**Interfaces:**

- Produces: `countSaved(rows: readonly { paper_id: string }[] | null | undefined): number` — distinct `paper_id`s.

- [ ] **Step 1: Write failing tests** — `countSaved([{paper_id:"a"},{paper_id:"a"},{paper_id:"b"}]) === 2`; `countSaved([]) === 0`; `countSaved(null) === 0`.
- [ ] **Step 2:** `pnpm vitest run src/components/projects/saved-count.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement with a `Set`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(projects): count a project's saved papers`.

### Task 2: `ProjectTabs` client component

**Files:**

- Create: `src/components/projects/project-tabs.tsx` (`"use client"`)

**Interfaces:**

- Consumes: `countSaved` (Task 1), `getSupabaseBrowserClient()`.
- Produces: `ProjectTabs({ projectId: string; initialSaved: number })`.

- [ ] **Step 1:** Tabs = `[{segment:null,label:"Deck",icon:Layers,href:/app/p/${id}}, {segment:"library",label:"Library",icon:BookMarked,…}, {segment:"group",label:"Group",icon:Users,…}]`. Active via `useSelectedLayoutSegment()`. `<nav aria-label="Project">` → `<ul class="grid grid-cols-3">` with a bottom `border-b border-border` rule; active `Link` is `-mb-px rounded-t-xl border border-b-card bg-card font-semibold text-primary hc:border-2`, inactive `text-muted-foreground hover:text-foreground`, all `min-h-11 justify-center gap-2`.
- [ ] **Step 2:** Count pill after "Library" when `saved > 0`: `rounded-full bg-secondary px-2 text-xs tabular-nums text-secondary-foreground`, `aria-hidden`, plus `<span class="sr-only">, {n} saved</span>`.
- [ ] **Step 3:** Live count: `useEffect` on `projectId` → channel `library-count:${projectId}`, `postgres_changes` INSERT + UPDATE (filter `project_id=eq.${projectId}`) and DELETE (no filter) on `swipes` → `schedule()` (300 ms debounce). Recount = `from("swipes").select("paper_id").eq("project_id",id).eq("decision","save")` → `countSaved`; ignore errors (keep last count); a request-sequence ref drops responses older than the newest. Also `schedule()` when the active segment changes. Skip everything for non-uuid ids. Remove channel + clear timer on cleanup.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint` → clean.
- [ ] **Step 5:** Commit `feat(projects): add deck, library and group tabs with a live saved count`.

### Task 3: Project layout + page cleanup

**Files:**

- Create: `src/app/app/p/[projectId]/layout.tsx`
- Modify: `src/app/app/p/[projectId]/page.tsx` (drop title/invite row, `Title`, `InviteFor`; keep `projectInfo` for the deck)
- Modify: `src/app/app/p/[projectId]/library/page.tsx` (h1 → `sr-only` h2 "Library"; drop group link; summary "N papers saved")
- Modify: `src/app/app/p/[projectId]/group/page.tsx` (h1 → `sr-only` h2 "Group reading list"; drop title line + nav; drop `LINK` if unused)

**Interfaces:**

- Consumes: `ProjectTabs` (Task 2), `ProjectInvite` (`src/components/group/project-invite.tsx`), `fixtureProject`.

- [ ] **Step 1:** Layout: `mx-auto flex w-full max-w-2xl flex-col gap-4` header → row (`h1` font-display text-2xl md:text-3xl text-balance break-words text-primary, Suspense title; Suspense `ProjectInvite`) → Suspense `ProjectTabs` (fallback: static tabs with `initialSaved={0}` is fine — reuse the component). Server `headerData(projectId)` (React `cache`) returns `{ title, saved }`; non-uuid / error → `fixtureProject.title`, 0. Then `{children}` below with `gap-6`.
- [ ] **Step 2:** Page edits as listed; deck page keeps the `-mx-4 overflow-x-clip` wrapper and `max-w-md` column.
- [ ] **Step 3:** `pnpm check && pnpm build` → pass.
- [ ] **Step 4:** Commit `feat(projects): share one project header across deck, library and group`.

### Task 4: Verify in the real app

- [ ] **Step 1:** `/run-app`: demo project at 375px and 320px, light + dark + hc; deck, library, group. Check Review Focus items 1, 2, 5.
- [ ] **Step 2:** Fix findings; `pnpm check && pnpm build`; commit `fix(projects): …` as needed.
- [ ] **Step 3:** Tick PR-04 in `docs/checklists/05-projects.md`, then `/ship-pr`.
