# GR-03 — Group reading list and disagreement flags

**Goal:** one page where a group sees what it saved together, ranked by how many members saved each paper, and settles the papers it disagrees on.

## User flow

- **`/app/p/[id]/group`**, linked from the Invite dialog and the library header.
- **Summary:** "N members · N papers saved · N to discuss".
- **To discuss:** papers at least one member saved and at least one skipped, marked with a warning edge. Each card shows:
  - the paper's meta, title and "why it matters";
  - "1 saved · 1 skipped";
  - vote chips ("You saved", "Priya skipped"). Each chip has an icon and wording, and skips have a dashed border, so it isn't colour alone.
- **Resolve:** **Save it after all** / **Skip it after all** change your own vote through the existing `POST /api/projects/[id]/swipes`. The update is optimistic and reverts with a toast if it fails. When everyone agrees, the card moves to Group picks. When nobody has it saved any more, it leaves the list. Each case is announced, and focus follows the card or moves to a section heading.
- **Discuss:** **Copy for group chat** copies "Should we keep “Title”? 1 saved it, 1 skipped it. <link>".
- **Group picks:** papers everyone who voted saved, with "Saved by N of M" and a bar.

## Data

`loadGroup` reads as the user, so RLS limits everything to members:

- the project;
- members, in join order;
- all swipes;
- papers anyone saved;
- analyses (for "why it matters");
- profiles (display names).

Names fall back to "Member N". The current user is "You". `summariseGroup`, `applyVote` and `memberLabels` are pure and unit-tested.

## Edge cases

- **Nothing saved yet:** an empty state that points back to swiping.
- **Solo member:** a tip to use Invite.
- **Non-member or bad id:** not found.
- **Profiles or analyses fail to load:** the page still renders without names or summaries.

## Out of scope

Realtime updates (GR-02), comments or threads, owner overrides, combined ranking (RK-04).
