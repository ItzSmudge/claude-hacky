# SW-05 Persist Swipes Implementation Plan

**Goal:** store every save/skip/undo in `public.swipes` without the deck ever waiting, and resume the deck without already-swiped papers.

**Architecture:** a pure write queue (`swipe-sync.ts`, unit tested) sits behind a thin client wrapper (`persisted-swipe-deck.tsx`) that plugs into `SwipeDeck`'s existing `onDecide`/`onUndo` callbacks. A route handler writes through the RLS-scoped server client. The page reads existing swipes inside `<Suspense>`.

**Spec:** `docs/specs/2026-10-15-sw-05-persist-swipes.md`

## Constraints

- Owned paths: `src/components/swipe`, `src/app/app/p/[projectId]/page.tsx`, `src/app/api/projects/[projectId]/swipes/route.ts` (swipe per architecture.md). No contract changes, no deps, no migrations.
- Server writes use `getSupabaseServerClient()` (never the admin client). Errors follow `apiErrorSchema`.
- Commits `type(swipe): lowercase summary`.

## Tasks

- [ ] **1. `swipe-sync.ts` (TDD).** Files: `src/components/swipe/swipe-sync.ts`, `swipe-sync.test.ts`. Write tests first for `classifyStatus` and the queue rules in the spec (fake timers). Check: `pnpm test swipe-sync`.
- [ ] **2. Route handler.** File: `src/app/api/projects/[projectId]/swipes/route.ts` (`RouteContext<"/api/projects/[projectId]/swipes">`). Check: `pnpm typecheck`; with `pnpm dev` and an anonymous-session cookie, curl POST/re-POST/DELETE and the 400/401/403/404 paths, confirm rows via psql.
- [ ] **3. `persisted-swipe-deck.tsx`.** Builds the sync once (`useState` initialiser), `fetch` with `keepalive`, toasts per spec, passes callbacks to `SwipeDeck`. Check: `pnpm lint && pnpm typecheck`.
- [ ] **4. Page.** `page.tsx` stays sync; a `<Suspense fallback={<DeckSkeleton/>}>` child awaits `params`, reads `swipes` (`paper_id`, own user, this project), filters `fixturePapers`, renders `PersistedSwipeDeck`. Check: `pnpm build` (no Cache Components errors); browser: swipe → reload → paper gone.
- [ ] **5. Review + verify.** `pr-reviewer`, `a11y-reviewer`; Playwright at 360px light/dark: swipe, undo, offline → toast + Retry; `pnpm check && pnpm build`.
