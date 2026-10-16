# PR-04 — Project nav (Deck · Library · Group)

## Goal

Move between swiping, the library and the group list at any moment — mid-deck, on a phone, during the demo —
without finishing the deck or opening the invite dialog. Today the deck only links to the library from its
end state, and the group page is only reachable from the invite dialog.

## User flow

1. Open a project. Under the project title is a tab row: **Deck · Library (n) · Group**.
2. Swipe right a few times; the Library count ticks up within a second or so (a teammate's saves count too).
3. Tap Library → saved papers, relations, export. Tap Deck → back to the same place in the deck.
4. Group tab → the group reading list. Invite button + "n swiping" presence sit by the title on every tab.

## Design

- New `src/app/app/p/[projectId]/layout.tsx` owns the header: project title (Fraunces `h1`, wraps) with
  `ProjectInvite` (presence + invite) beside it, then the tabs. Header width `max-w-2xl`; the deck keeps its
  narrow `max-w-md` column below.
- `ProjectTabs` (client, `src/components/projects/project-tabs.tsx`): a `<nav aria-label="Project">` with three
  `Link`s. Active tab from `useSelectedLayoutSegment()` (`null` → Deck), marked `aria-current="page"`.
- Look: card-catalogue divider tabs. Tabs sit on a 1px `border-border` rule; the active one is a raised
  `bg-card` tab (`rounded-t-xl`, border on three sides, covers the rule, semibold), others are muted text.
  Icon (lucide, 1.75) + label, so the active state isn't colour alone. Phones: three equal columns, `min-h-11`.
  `hc:` gives the active tab a 2px border.
- Count: a `rounded-full` pill with `tabular-nums` after "Library"; screen readers hear "Library, 7 saved".
  Hidden while 0 (copy stays "Library"). Not `aria-live` (the deck already announces each save).
- Pages: Library and Group lose their visible `h1` and ad-hoc links ("See what the whole group saved",
  "Back to swiping", "Your library"); each keeps an `sr-only` `h2`. The deck's title/invite row moves to the
  layout; its end-of-deck "Open library" link stays. Library's summary line becomes "7 papers saved".

## Inputs / outputs

- Layout reads `projects.title` and the initial saved count (distinct `paper_id` with `decision = 'save'`) as
  the user. Non-uuid id or read error → the demo fixture's title, count 0 (matches the deck's fallback today).
- Live count: a Supabase realtime channel `library-count:<projectId>` on `swipes` (INSERT/UPDATE filtered by
  project; DELETE unfiltered, since realtime can't filter deletes) → debounced (300 ms) recount query. Also
  recounts when the active tab changes. Pure `countSaved(rows)` helper is unit-tested.

## Edge cases

- Undo / remove-from-library / start over delete rows → caught by the DELETE recount.
- Recount fails → keep the last count; never show an error in the tab.
- Long project titles wrap; tabs never scroll sideways at 320px.
- Not signed in yet (guest session starting) → count 0 until the first recount succeeds.

## Out of scope

Bottom tab bar; changes to the app header or sidebar; unread/new badges on Group; per-user counts.

## Ownership note

Touches swipe (`p/[projectId]/page.tsx`), library and group page files to remove duplicated headers. Called out
in the PR.
