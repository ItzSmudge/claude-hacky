# Submission form draft (RD-05)

Copy-paste text for the hackathon submission form. Fill in the `TODO` lines before submitting.

**Project name:** PaperCut

**Track:** Better Student Life

**One-liner (≤ 15 words):** Tinder for research papers: swipe real papers, see why each matters,
export a correct bibliography.

**Live demo:** https://papercut-ten.vercel.app. No signup: press **Open demo project**, or join
with code **DEMO42**.

**Repo:** TODO (the repo is private: share access with the judges or attach a zip if the form
asks for code)

**Team:** TODO (names and roles)

**Video / slides:** TODO (optional)

## Short description (≈ 50 words)

Students lose hours judging search results and fixing citations that chatbots invented.
PaperCut turns your assignment brief into claims to test, then serves real papers from
OpenAlex as swipeable cards. Each card says why the paper matters, whether it supports or
challenges each claim, and how credible it is. Export clean BibTeX in one tap, solo or as a
group.

## Long description

**The problem.** A student starting an essay has a question, a marking rubric and a search box
that returns thousands of results. Working out which papers are relevant, which side they're on
and whether they're any good takes hours. Then the citations go wrong, especially when an AI
chatbot "helps" by inventing them.

**What we built.**

- **Brief-aware start.** Upload the brief or rubric. Claude extracts the topic and the claims
  you need to test, and you edit them.
- **A swipe deck of real papers.** Each card shows:
  - why the paper matters for _your_ brief;
  - an overview;
  - its stance on each claim (shown with icons and text, not just colour);
  - a relevance score;
  - a credibility badge that shows how it was calculated.
- **Learns as you swipe.** The deck re-ranks itself and offers one-tap insights like "You keep
  skipping reviews. Hide them?"
- **Group mode.** Teammates join from their phones with a 6-letter code, with no account. You get
  live presence, a live feed of saves and a group reading list that flags disagreements for
  discussion.
- **A library that thinks.** Papers are grouped by how you'll use them or by claim. "How your
  papers connect" shows which claims your sources argue about, shared methods, and which pairs
  to read side by side.
- **Export.** BibTeX (from doi.org), a LaTeX `thebibliography` block, CSV, a Markdown reading
  list, and a single `\cite{…}`.
- **Accessible.** Keyboard and screen-reader support, read-aloud, voice commands
  ("save", "skip", "read"), high-contrast and larger-text modes, dark mode and reduced motion.
  It works on phones.

**Every citation is real.** Claude never writes a title, author, year, venue, DOI, link or BibTeX
entry:

- That data comes only from OpenAlex, Semantic Scholar and Crossref, and is rendered by code.
- Claude refers to papers by internal id; any unknown id is thrown away.
- Every model answer is JSON validated by a zod schema with word limits. Missing information
  becomes "not stated".
- Credibility is a deterministic formula (citations per year, peer review, venue type, recency),
  never the model's opinion.

**How we used Claude.**

- **The product:**
  - A smart model reads briefs (PDF, Word or text).
  - A fast model analyses each paper against the brief, streamed so the deck never waits, with
    the project context prompt-cached across the deck.
  - A smart model finds relations across the saved set and phrases the swipe insights.
- **The build:** the whole app was built by a small team working with Claude Code. Each task went
  spec → plan → TDD → review: a PR-review subagent checked against our hard rules and an
  accessibility-review subagent checked UI changes. Every PR ran CI.

**Stack.** Next.js 16 and React 19, Tailwind 4 and shadcn, Supabase (Postgres with RLS, anonymous
auth, Realtime), the Anthropic SDK and zod, Vercel and Supabase in London.

**What's next.**

- A literature-review outline with `\cite` keys checked against your library.
- Google sign-in, so a guest session can become an account.
- Group-weighted ranking.
- Zotero sync.
