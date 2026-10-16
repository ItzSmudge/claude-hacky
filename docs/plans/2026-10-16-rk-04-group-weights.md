# RK-04 Group weights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each person's deck ranks by their own swipes plus teammates' (at half strength), updating live without moving the top two cards.

**Architecture:** Pure helpers in `src/lib/ranking/group.ts` (combine weights, pin the head, parse/apply Realtime swipe changes) with TDD; `rankItems` takes optional team histories. The deck page loads all project swipes split mine/teammates'; a new hook in the swipe component keeps teammates' histories live via Supabase Realtime.

**Tech Stack:** TypeScript, Vitest, zod, Next.js 16 (Cache Components), Supabase Realtime.

**Spec:** `docs/specs/2026-10-16-rk-04-group-weights.md`

## Global Constraints

- Team weight `0.5`; teammates' weights are **averaged** (mean over teammates), then scaled.
- ≥ 6-swipe threshold counts mine + teammates' swipes.
- Pinned head on teammate-caused re-rank: `n = 2`.
- No `teamHistories` (or empty) → `rankItems` output identical to today.
- Insight toasts (`findInsight`) keep using **my** history only.
- No new deps, no migrations, no new UI copy. Touch outside `src/lib/ranking` only: `src/app/app/p/[projectId]/page.tsx`, `src/components/swipe/persisted-swipe-deck.tsx`, new `src/components/swipe/use-team-histories.ts`, and a one-word `export` on `authoriseRealtime` in `src/components/group/live-presence.tsx`.
- Commits: `feat(ranking): …`, lower-case subject (commitlint enforces subject-case).

## Review Focus

- Teammate swipes on a paper **I already decided** (not in deck items) → still counts (features from fixtures). Test in Task 3.
- Realtime `DELETE` for another project (unfiltered by Realtime) → ignored. Test in Task 2.
- A teammate changes their mind (skip → save, Realtime `UPDATE`) → replaces, never double-counts. Test in Task 2.
- My own rows arriving over Realtime → ignored (already local). Test in Task 2.
- `keepHead` when a pinned card was filtered out / no longer in `next` → dropped, not resurrected. Test in Task 1.

---

### Task 1: Combined weights, `rankItems` team option, `keepHead`

**Files:**

- Create: `src/lib/ranking/group.ts`, `src/lib/ranking/group.test.ts`
- Modify: `src/lib/ranking/weights.ts` (`rankItems` options), `src/lib/ranking/index.ts` (exports)

**Interfaces:**

- Produces:
  - `combineWeights(own: SwipeSample[], teammates: SwipeSample[][], opts?: { teamWeight?: number; decay?: number }): Weights`
  - `rankItems(items, featuresOf, history, { minSwipes?, decay?, teamHistories?: SwipeSample[][], teamWeight?: number })`
  - `keepHead<T>(previous: T[], next: T[], n?: number, key?: (t: T) => string): T[]` — `key` defaults to identity.

- [ ] **Step 1: Write failing tests in `group.test.ts`**
  - `combineWeights(own, [])` deep-equals `learnWeights(own)`.
  - One teammate who saved a paper with `["topic:x"]` once, own empty → weight of `topic:x` is `0.5`.
  - Two teammates, one saved `["topic:x"]`, one skipped `["topic:x"]` → `topic:x` is `0`. Two teammates who both saved it → `0.5` (mean, not sum).
  - `rankItems` with 0 own swipes and a teammate history of 6 saves on `topic:x` → item with `topic:x` moves ahead of one without; with `teamHistories: []` and 0 own swipes → returns the same array (`toBe`).
  - `rankItems` with own history of 6 and `teamHistories: undefined` equals output with `teamHistories: []`.
  - `keepHead([a,b,c,d], [d,c,b,a])` → `[a,b,d,c]`; `keepHead([a,b,c], [c,a])` → `[a,c]` (b gone, not resurrected); `keepHead([], next)` → `next`.
- [ ] **Step 2:** `pnpm vitest run src/lib/ranking` → new tests FAIL (missing exports).
- [ ] **Step 3: Implement** `combineWeights` (own `learnWeights` + `teamWeight` × per-feature mean over teammates' `learnWeights`; a teammate with no swipes still counts in the mean denominator only if non-empty — skip empty histories). In `rankItems`: threshold on `history.length + Σ teamHistories lengths`; idf pool also includes teammates' features; use `combineWeights` when `teamHistories?.length`, else `learnWeights`. `keepHead` as specified.
- [ ] **Step 4:** `pnpm vitest run src/lib/ranking` → all PASS (existing `weights.test.ts` unchanged and green).
- [ ] **Step 5:** `git commit -m "feat(ranking): combine teammates' swipe weights"`

### Task 2: Realtime swipe change parsing + team history reducer

**Files:**

- Modify: `src/lib/ranking/group.ts`, `src/lib/ranking/group.test.ts`, `src/lib/ranking/index.ts`

**Interfaces:**

- Produces:
  - `type TeamDecisions = Map<string /* userId */, Map<string /* paperId */, SwipeDecision>>`
  - `type TeamSwipeChange = { userId: string; paperId: string; decision: SwipeDecision | null }` (`null` = removed)
  - `teamSwipeChange(payload: unknown, ctx: { projectId: string; me: string }): TeamSwipeChange | null` — `payload` is the supabase-js `RealtimePostgresChangesPayload` (`eventType`, `new`, `old`); zod-parsed. `DELETE` reads `old` (PK: `project_id`, `paper_id`, `user_id`); others read `new`.
  - `applyTeamChange(team: TeamDecisions, change: TeamSwipeChange): TeamDecisions` — returns a **new** Map (React state); removing a user's last paper drops the user.
  - `teamDecisionsFrom(rows: { userId: string; paperId: string; decision: SwipeDecision }[]): TeamDecisions` (oldest-first rows).

- [ ] **Step 1: Write failing tests**
  - INSERT by teammate `u2` in project `p1`, decision `save` → `{ userId: "u2", paperId, decision: "save" }`.
  - Row by `me` → `null`; row with `project_id` ≠ ctx → `null` (both INSERT and DELETE); decision `"maybe"` or missing fields → `null`.
  - DELETE with only `old: { project_id, paper_id, user_id }` → `decision: null`.
  - `applyTeamChange`: skip then save same paper → one entry, `"save"`, position unchanged; delete → entry gone; deleting last entry removes the user; input map not mutated.
- [ ] **Step 2:** `pnpm vitest run src/lib/ranking/group.test.ts` → FAIL.
- [ ] **Step 3: Implement** the three functions in `group.ts`.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5:** `git commit -m "feat(ranking): track teammates' swipes from realtime changes"`

### Task 3: Load teammates' swipes on the deck page

**Files:**

- Modify: `src/app/app/p/[projectId]/page.tsx`

**Interfaces:**

- Consumes: `teamDecisionsFrom` (Task 2).
- Produces: new `PersistedSwipeDeck` props `userId?: string` and `initialTeam?: { userId: string; paperId: string; decision: SwipeDecision }[]` (oldest first, teammates only).

- [ ] **Step 1:** Change `swipeHistory` to select `paper_id, user_id, decision` for the whole project (drop `.eq("user_id", …)`), returning `{ userId, mine, team }`. `mine` keeps today's shape and drives `swiped`/`initialHistory` exactly as now; `team` = rows whose `user_id` ≠ me.
- [ ] **Step 2:** Pass `userId` and `initialTeam` to `PersistedSwipeDeck`.
- [ ] **Step 3:** `pnpm typecheck` → passes (props added as optional in Task 4; do Tasks 3+4 in one commit if typecheck needs it).

### Task 4: Live team histories in the deck

**Files:**

- Create: `src/components/swipe/use-team-histories.ts`
- Modify: `src/components/swipe/persisted-swipe-deck.tsx`, `src/components/group/live-presence.tsx` (`export` `authoriseRealtime`)

**Interfaces:**

- Consumes: `teamDecisionsFrom`, `teamSwipeChange`, `applyTeamChange`, `keepHead`, `rankItems` team option.
- Produces: `useTeamHistories({ projectId, userId, initialTeam, featuresOf }): SwipeSample[][]` where `featuresOf(paperId) → string[] | undefined`.

- [ ] **Step 1: Hook.** State = `teamDecisionsFrom(initialTeam)`. If `userId` set: channel `deck-team:${projectId}` with `postgres_changes` `INSERT`/`UPDATE` (filter `project_id=eq.${projectId}`) and `DELETE` (no filter); each payload → `teamSwipeChange` → `applyTeamChange`. Subscribe after `authoriseRealtime()` (same cancelled-guard pattern as `useLiveRefresh`); `removeChannel` on unmount. Return per-teammate `SwipeSample[]`, dropping papers `featuresOf` can't resolve.
- [ ] **Step 2: Wire into deck.** `featuresOf` = deck `featureIds.get(id)`, falling back to `extractFeatures` over the matching `fixturePapers` entry (same `now`/credibility as the page). Pass `teamHistories` to `rankItems`. When the re-rank was caused only by a team change (own `decisions`, `filters.active`, `undoneId`, `items` all unchanged since the last ranked order — track with a ref), apply `keepHead(prevRanked, nextRanked, 2, (i) => i.paper.id)`. `findInsight` still gets `history` (mine only).
- [ ] **Step 3:** `pnpm check && pnpm build` → passes.
- [ ] **Step 4: Manual check** (run-app skill): demo user + a second user in `DEMO42`, two browsers. Second user saves 6 papers sharing a topic → demo user's cards 3+ reorder, top two unchanged; second user Undo → order relaxes back.
- [ ] **Step 5:** `git commit -m "feat(ranking): rank the deck by the group's swipes live"`
