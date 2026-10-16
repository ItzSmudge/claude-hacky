# GR-02 plan — Realtime presence and live feed

1. Pure helpers, TDD: `src/components/group/live.ts` (+ test): `presenceText`, `teammateSave`, `feedText`.
2. `src/components/group/live-presence.tsx`: `LivePresence` (presence pill + feed toast) and `useLiveRefresh` (debounced `router.refresh` on swipe changes). Set the Realtime token before subscribing.
3. `project-invite.tsx` renders the pill beside Invite, with member labels read as the user. The group list calls `useLiveRefresh`.
4. Deck header (swipe-owned, noted in the PR): title and tools wrap on narrow screens.
5. Verify: `pnpm check && pnpm build`; Playwright with owner + phone guest (pill appears and disappears, feed toast names the person and paper, own swipes are quiet, group page updates live); pr-reviewer + a11y-reviewer.
