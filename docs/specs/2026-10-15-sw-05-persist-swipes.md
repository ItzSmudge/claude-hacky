# SW-05 — Persist swipes

**Goal:** every save, skip and undo on the deck is stored in `public.swipes`, so the library, reading list, group mode (GR-\*) and ranking (RK-\*) see real data. The deck never waits on the network: the card leaves at once (optimistic) and the write happens in the background. If a write fails, the student is told and can retry. Reloading the deck doesn't show papers they already swiped.

## Units

| File                                               | Job                                                                                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/projects/[projectId]/swipes/route.ts` | `POST` body `swipeRequestSchema` → upsert own swipe; `DELETE ?paperId=` → delete own swipe (undo). Both `204`. Server client (RLS as the user).                                                                                              |
| `src/components/swipe/swipe-sync.ts` (+ test)      | Pure, framework-free write queue: `createSwipeSync({ send, onFailure, retryDelaysMs })`. One request in flight per paper; later ops for the same paper collapse to the latest. Transient failures retry with backoff; others report at once. |
| `src/components/swipe/persisted-swipe-deck.tsx`    | Client wrapper: builds the sync with `fetch` (`keepalive`), wires `onDecide`/`onUndo` into `<SwipeDeck>`, shows sonner toasts on failure.                                                                                                    |
| `src/app/app/p/[projectId]/page.tsx` (modify)      | Reads `projectId` and the user's existing swipes inside `<Suspense>`, drops already-swiped papers from the deck, renders `<PersistedSwipeDeck>`.                                                                                             |

## API

- `projectId` not a uuid → `400`. No signed-in user → `401`. Body/query fails zod → `400 { error, details }`.
- `POST`: upsert `{ project_id, paper_id, user_id, decision }` on `(project_id, paper_id, user_id)` — swiping the same paper again (after undo, or from another tab) just changes the decision.
- `DELETE ?paperId=`: delete the user's row; deleting nothing is still `204` (idempotent undo).
- Postgres `42501` (RLS: not a member) → `403`; `23503` (unknown paper) → `404`; anything else → `500` (logged, no details leaked).

## Sync rules (`swipe-sync.ts`)

- Ops: `{ paperId, decision: "save" | "skip" }` (upsert) or `{ paperId, decision: null }` (undo → delete).
- `send` resolves to `"ok" | "retry" | "fail" | "unauthorised"`; `classifyStatus(status)` maps HTTP: 2xx ok, 401 unauthorised, 408/429/5xx/network retry, other 4xx fail.
- Per paper: if a request is in flight, the new op replaces any pending one and is sent when the in-flight one settles. Ops for different papers run in parallel.
- `retry` → re-send after 1s, then 3s; still failing → `onFailure(op, "retry")`. `fail`/`unauthorised` → `onFailure` at once, no retry. A newer pending op for the same paper supersedes a retrying one (no failure reported for the stale op).

## UX

- Optimistic: the deck animates and announces exactly as now; no spinners.
- Failure toast (sonner, error): "Couldn't save your swipe on ‹title›." with a **Retry** action that re-queues the same op. Unknown title → "this paper".
- `unauthorised`: one info toast per page load — "You're not signed in, so swipes won't be kept." (Anonymous sign-in is PR-02/PR-03; until then the deck still works locally.)
- Reload: papers this user already swiped in this project are left out of the deck. If the swipe read fails or there is no user, show all papers.

## Edge cases

Save → undo → save fast on one card (collapses, last op wins, order kept); undo of a save whose POST is still in flight (DELETE waits for it); rapid swipes on many cards (parallel); navigating away right after a swipe (`keepalive`); RLS-denied project (403 → toast, no retry); unknown paper id (404 → toast); toast Retry while a newer op for the paper exists (newer op wins).

## Testing

TDD `swipe-sync.ts` with a fake `send` and fake timers: ordering per paper, collapsing, parallel papers, retry/backoff then failure, no retry on fail/unauthorised, superseded retry, `classifyStatus` table. Route checked against local Supabase with an anonymous-session cookie: POST, re-POST (decision changes), DELETE, 400/401/403/404. Browser at 360px: swipe, reload → swiped paper gone; kill the network → toast with Retry. Then `pr-reviewer`, `a11y-reviewer`, `pnpm check && pnpm build`.

## Out of scope

Anonymous sign-in / auth UI (PR-02/03), the real paper queue (SW-04 still feeds fixtures), realtime feed (GR-02), re-ranking (RK-02), `useAs` choice, offline storage across reloads.
