# GR-03 plan — Group reading list

1. Pure logic, TDD: `src/components/group/group-list.ts` (+ test): `summariseGroup`, `applyVote`, `memberLabels`.
2. Loader: `src/components/group/load-group.ts`, reading as the user (project, members, swipes, papers, analyses, profiles).
3. UI: `src/components/group/group-reading-list.tsx`, with the To discuss and Group picks sections, vote changes, copy for chat, announcements and focus handling.
4. Route: `src/app/app/p/[projectId]/group/page.tsx`, in Suspense with a skeleton; notFound for non-members.
5. Entry points: a link in the Invite dialog (group-owned), and a single link in the library header (library-owned; noted in the PR).
6. Verify: `pnpm check && pnpm build`; Playwright (owner + phone guest: split → resolve → picks; all skip → leaves the list; focus; copy; links; not-found); then pr-reviewer + a11y-reviewer.
