# GR-02 — Realtime presence and live swipe feed

**Goal:** swiping together feels live. You can see who else has the deck open, and you hear about teammates' saves as they happen. The group list keeps itself up to date.

## User flow

- **Deck header:** a "3 swiping" pill appears next to **Invite** while teammates have this project's deck open. A screen reader hears "You and 2 others are swiping now". The pill is hidden when you're alone and disappears when people leave.
- **Live feed:** when a teammate saves a paper, one toast reads "Priya saved “Title…”". The same toast updates in place, so a busy group doesn't stack them up. Your own swipes and everyone's skips stay quiet.
- **Group page (GR-03):** refreshes itself about 400 ms after anyone votes, so new splits and picks appear without a reload.

## How

- **Channel:** one Supabase Realtime channel per project deck (`project:<id>`).
  - **Presence:** keyed by user id, so the same person in two tabs counts once.
  - **Changes:** listens for INSERT and UPDATE on `swipes`, filtered by `project_id`. RLS only sends rows to members.
- **Auth:** the browser client sets the Realtime token from the session before subscribing. Without this, the cookie client can join as anonymous and RLS drops every change.
- **Names:** come from the server (`memberLabels`). An unknown person appearing in presence triggers a refresh, so new joiners are named, not "A teammate".
- **Pure helpers, unit-tested:** `presenceText`, `teammateSave`, `feedText`.

## Edge cases

- Realtime down or blocked: no pill and no toasts; everything else works.
- Undo (DELETE) isn't in the feed or the live refresh: Supabase can't filter or RLS-check deletes, so subscribing would leak other projects' keys. The group page catches up on the next vote or reload.
- Saves are throttled: the first shows at once, then at most one summary every 5 s ("Priya and 2 others saved 5 papers").
- Long titles are cut on a word boundary.

## Out of scope

Typing or cursor presence, avatars, a feed history panel, push notifications.
