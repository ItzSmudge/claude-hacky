# RK-04 — Group mode: rank by combined weights

## Goal

In a shared project, each person's deck learns from the whole group, not just their own swipes.
Your own swipes count fully; teammates' count at half strength. Teammates' swipes arrive live, so
upcoming cards reorder while the group swipes — without moving the card you're looking at.

## User flow

1. Priya saves four ML-fairness papers and skips two surveys in project DEMO42.
2. Sam opens the same project's deck with no swipes of their own: ML-fairness papers come up first,
   surveys sink. (Today Sam would see plain relevance order until their own 6th swipe.)
3. While Sam swipes, Priya keeps going on her phone. Sam's top card and the one under it stay put;
   cards further back reorder as Priya's swipes stream in.
4. Someone swiping alone sees exactly today's behaviour.

## Inputs / outputs

- **Pure logic (`src/lib/ranking/group.ts`, TDD):**
  - `combineWeights(own, teammates, { teamWeight = 0.5 })` → `Weights`. `own` is my
    `SwipeSample[]`; `teammates` is one `SwipeSample[]` per teammate. Each history goes through
    `learnWeights` separately (decay per person). Result = own + teamWeight × _mean_ of teammates'
    weights — a mean, so five teammates don't drown out one person.
  - `rankItems` gains an optional `teamHistories` option. The ≥ 6-swipe threshold counts all swipes
    (mine + teammates'); idf covers teammates' swiped papers too. No `teamHistories` → identical output
    to today (existing tests stay green).
  - `keepHead(previous, next, n = 2)` → the first `n` cards of `previous` that are still in `next`,
    then the rest of `next` in order. Used only when a re-rank was caused by a teammate's swipe.
- **Load (`src/app/app/p/[projectId]/page.tsx`):** read all the project's swipes (RLS already lets
  members read them), split by `user_id` into mine vs. teammates', map to features the same way as
  today (fixture lookup), pass `initialTeamHistories` to the deck.
- **Live (`src/components/swipe/persisted-swipe-deck.tsx`):** subscribe to Realtime `INSERT`/`UPDATE`/
  `DELETE` on `swipes` for this project. Rows by me are ignored (my own swipes are already local). A
  teammate's row sets their decision for that paper (keyed by paper, latest wins, so a changed mind
  replaces rather than double-counts); a `DELETE` removes it. Parsing a payload into
  `{ userId, paperId, decision | null }` is a pure, tested helper. Unsubscribe on unmount.

## Edge cases

- Teammate swiped a paper I haven't seen: it stays in my deck; their swipe only shapes the order.
- Teammate's paper isn't in the fixtures/feature map: dropped, as today. A live swipe on a paper I
  already decided (so not in my deck items) still counts: look its features up the same way the page
  does. _(Builder's call.)_
- Teammate's Undo or "start over": `DELETE` events carry the primary key (project, paper, user), so
  their swipe is removed live. Realtime can't filter `DELETE` by column, so check `project_id` client-side.
- Realtime fails or the user isn't signed in: the deck works from the history loaded with the page.
- My own swipe: the whole remaining deck re-ranks as today (the top card just left anyway).
- Undo-restored card and insight filters (RK-03) still apply on top of the combined order.
- Insight toasts stay based on my own swipes only ("You keep skipping…" must be about me).

## Out of scope

- A Me/Group toggle or any new UI copy; the GR-02 live feed already shows teammates' activity.
- Per-member trust or role weighting; agreement-seeking ranking.
- Throttling re-ranks (one teammate swipe per second or two is cheap to re-rank).

## Ownership note

RK-04 owns `src/lib/ranking`. Wiring touches `src/app/app/p/[projectId]/page.tsx` and
`src/components/swipe/persisted-swipe-deck.tsx` (swipe workstream) — keep it to loading/passing team
histories and the Realtime subscription, and call it out in the PR.
