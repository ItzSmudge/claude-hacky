# PaperCut — swipe right on research

**Tinder for research papers.** Tell PaperCut what you're writing, swipe through real papers, see
in one line why each one matters for _your_ assignment, and walk away with a correct
bibliography.

**Live:** https://papercut-ten.vercel.app. Try it with no signup: open the app and press **Open
demo project**, or join a group with the code **DEMO42**.

Built for the Claude hackathon (London), _Better Student Life_ track.

## The problem

Students start an essay with a question and a marking rubric, then lose hours in search results
they can't judge: Is this paper relevant? Does it support or challenge my argument? Is it any
good? Then come the citations, which chatbots happily invent.

## What it does

1. **Tell it what you're writing.** Type your research question and, optionally, drop in the
   brief or rubric (PDF, Word or text). Claude pulls out the topic and the claims you need to
   test, and you can edit them before you start.
2. **Swipe through real papers.** Papers come from OpenAlex and Semantic Scholar. Each card shows:
   - why the paper matters for your brief;
   - a short overview;
   - whether it supports or challenges each of your claims;
   - a relevance score;
   - a credibility badge that shows how it was worked out.

   Swipe right to save and left to skip, use ← → ↑ Z, or use the buttons.

3. **It learns as you go.** After a few swipes the deck re-ranks itself. When there's a clear
   pattern, it says so: _"You keep skipping reviews. Hide them?"_ One tap applies a filter, and
   one tap undoes it.
4. **Swipe as a group.** Share a join code or link and teammates join from their phones with no
   account. You see who's swiping, a live feed of saves, and a group reading list. Papers the
   group disagrees on are flagged **To discuss**.
5. **Make sense of your library.** Saved papers are grouped by how you'll use them (evidence,
   counterpoints, methods, background) or by claim. **How your papers connect** shows which
   claims your papers argue about, which share a method, and which to read side by side.
6. **Export.** Get BibTeX for Overleaf or Zotero, a LaTeX `thebibliography` block, CSV, a
   Markdown reading list, or one `\cite{…}` command with every key.

**Accessible by default.** It works by keyboard and with screen readers (save/skip
announcements, focus management). Other options:

- read-aloud with a speed control;
- voice commands ("save", "skip", "read", "why", "details");
- high-contrast and larger-text modes;
- light and dark themes;
- reduced motion.

Stance is never shown by colour alone.

## Every citation is real

The design rule that shapes the whole app is that **Claude never writes bibliographic data.**

- **The source data comes from scholarly APIs.** Titles, authors, years, venues, DOIs and links
  come only from OpenAlex, Semantic Scholar and Crossref, and code renders them.
- **BibTeX comes from DOIs.** Entries are fetched from doi.org by content negotiation and checked,
  or built by code from that metadata.
- **Claude refers to papers by id only.** It answers using internal ids (or aliases such as `P3`),
  and any id it returns that we didn't give it is thrown away. It never sees DOIs or URLs it
  could echo back.
- **Every model answer is validated.** Each one is JSON checked against a zod schema with word
  limits. A failed check gets one repair attempt, and missing information becomes "not stated"
  rather than a guess.
- **Credibility is computed, not judged.** It's a deterministic 0–100 score in
  `src/lib/credibility.ts`, made up of:
  - citations per year (40 points);
  - peer review (30);
  - venue type (15);
  - recency (15).

  The badge shows these inputs.

## How Claude is used

| Where                     | Model tier | What it does                                                                                    |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Brief → project context   | smart      | Reads a PDF, Word or text brief and pulls out the topic, claims to test, themes and constraints |
| Paper analysis (streamed) | fast       | Why it matters, overview, stance per claim, methodology, limitations, how you'd use it          |
| How your papers connect   | smart      | Shared methods, and pairs to read together or against each other (paper ids only)               |
| Insight toast             | smart      | Turns a pattern that code found in your swipes into one friendly sentence                       |

- **Model choice:** models are set through `ANTHROPIC_MODEL_FAST` and `ANTHROPIC_MODEL_SMART`.
- **Prompt caching:** the project context is cached across a whole deck of analyses.
- **Streaming:** analyses stream in so the deck never waits.
- **Ranking:** re-ranking runs in code (`src/lib/ranking`), not in the model.

## Stack

- **Frontend:** Next.js 16 (App Router, Cache Components) and React 19, with Tailwind CSS 4,
  shadcn/Radix, `motion` and sonner.
- **Data and auth:** Supabase (Postgres with row-level security, anonymous auth, Realtime
  presence and database changes).
- **AI:** the Anthropic TypeScript SDK, zod and unpdf/mammoth for reading briefs.
- **Hosting:** Vercel (`lhr1`) and Supabase (London).
- **Quality:** Vitest (50+ test files), ESLint and TypeScript strict, plus conventional commits
  with CI on every PR.

Read more in [`docs/architecture.md`](docs/architecture.md).

## Run it locally

Prereqs: Node 24 (`nvm install` / `fnm use`), pnpm via corepack, Docker running.

```bash
pnpm bootstrap   # install, start local Supabase (migrations + seed), write .env.local
pnpm dev         # http://localhost:3000
```

Add `ANTHROPIC_API_KEY` to `.env.local` for the AI features. Without it, the deck falls back to 20
pre-analysed real papers. Local demo login: `demo@papercut.local` / `papercut-demo`.

```bash
pnpm check       # lint + typecheck + tests
pnpm build
pnpm db:reset    # re-run migrations + seed
```

## Contributing (team)

Read `CLAUDE.md`, then pick a task in [`docs/checklists/`](docs/checklists/) with
`/claim-task <ID>`. Specs and plans live in `docs/specs/` and `docs/plans/`. PRs go into `dev`.
Release PRs from `dev` to `main` are merged by ItzSmudge only.

Demo script: [`docs/demo-script.md`](docs/demo-script.md). Submission text:
[`docs/submission.md`](docs/submission.md).
