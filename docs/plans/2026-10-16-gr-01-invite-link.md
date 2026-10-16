# GR-01 plan — Join code and invite link

1. **Pure helpers (TDD).** `src/components/group/join-code.ts` + `join-code.test.ts`: `normaliseJoinCode`, `inviteUrl`. Check: `pnpm test src/components/group`.
2. **Join flow.** `src/components/group/join-project.tsx` (client): shared join promise per code, guest session, RPC, `router.replace` in a transition, states joining / unknown / failed. `src/components/group/join-code-form.tsx` (client): one labelled field, inline error. Check: typecheck.
3. **Routes.** `src/app/app/join/[code]/page.tsx` (replace placeholder; params in Suspense) and `src/app/app/join/page.tsx` (form). Check: `pnpm build`.
4. **Invite.** `src/components/group/invite-dialog.tsx` (client dialog: code, link, copy, share, member count) and `src/components/group/project-invite.tsx` (server: reads `join_code` + member count as the user). Check: typecheck.
5. **Entry points (outside owned paths, one line each, noted in the PR).** The deck page header renders `<ProjectInvite>` in Suspense; `/app` gets a "Have a join code?" link. Check: build.
6. **Verify.** Local browser run: two contexts (owner + phone guest) join through the link; then pr-reviewer + a11y-reviewer; `pnpm check && pnpm build`.
