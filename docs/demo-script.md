# Demo script: 2 minutes (RD-03)

The story runs problem → upload brief → swipe 5 → group joins from a phone → disagreement →
export LaTeX. There are two devices:

- **Laptop:** the presenter, projected.
- **Phone:** the teammate, ideally mirrored, or just held up to the camera.

Live: https://papercut-ten.vercel.app

## Before you go on (10 minutes before)

- [ ] **Reset the demo.** In Supabase → SQL Editor, run `supabase/demo/reset-demo.sql`. Expect
      `members 1, guest_swipes 0`.
- [ ] **Check the latest release is live.** The last `dev → main` merge must have been deployed,
      and `/` should load.
- [ ] **Check the AI is working.** On prod, create a throwaway project with any question. Claims
      should appear, and the first card should show "why it matters". This proves the Anthropic
      key works and warms up the functions. Delete the project afterwards.
- [ ] **Brief file ready.** `src/lib/ai/__fixtures__/brief.docx`, or any real one-page brief
      (PDF, Word or text, ≤ 4 MB), saved on the desktop.
- [ ] **Laptop:** a fresh **private window** (so it's a new guest), light theme, zoom 125 %, sound on.
- [ ] **Phone:** a fresh private tab, not yet joined. A QR code or a short link to
      `/app/join/<CODE>` is ready to type once the code is known.
- [ ] **Backup:** if anything fails live, the **Open demo project** button gives you a project
      with 20 pre-analysed real papers. You can run every step after "upload brief" there.
      Join code `DEMO42`.

## Script

| Time      | Do (laptop unless noted)                                                                                                                                                                        | Say                                                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | Landing page on screen. Point at the hero "Swipe right on research."                                                                                                                            | "You've got an essay due. You have a question, a rubric, and Google Scholar gives you 40,000 results. You can't tell what's relevant, whose side it's on, or if it's any good. And if you ask a chatbot, it invents citations."                      |
| 0:15–0:35 | **Try it — no signup** → in "What are you researching?" type _Does heavy social media use harm teenage mental health?_ → drop the brief on "Choose a file or drop it here" → **Read my brief**. | "PaperCut starts from your actual assignment. I give it my question and the brief…" (while it shows "Reading your brief…") "…and Claude pulls out the claims I need to test."                                                                        |
| 0:35–0:45 | "Here's what we found": point at **Claims to test**, then press **Start swiping**.                                                                                                              | "These are editable: it's my argument, not Claude's. Start swiping."                                                                                                                                                                                 |
| 0:45–1:10 | Swipe 5 cards: save 2 with →, skip 1 with ←, drag one by hand, save 1. On one card, tap the credibility badge.                                                                                  | "Every card is a real paper from OpenAlex. Claude tells me why it matters _for my brief_ and whether it supports or challenges each claim. With icons, not just colour. Credibility is a formula, not an opinion: here's exactly how it was scored." |
| 1:10–1:30 | **Invite** in the deck header → read out the join code. **Phone:** go to `/app/join/<CODE>` (or type the code at "Join a group"). The deck opens. Swipe 2 cards: **skip** one the laptop saved. | "Group project? Share the code. No accounts. My teammate's on their phone…" (point at the presence text: "You and 1 other are swiping now") "…and their saves show up live."                                                                         |
| 1:30–1:45 | Library → **See what the whole group saved** → **To discuss** section.                                                                                                                          | "We disagreed on this one: I saved it, they skipped it. PaperCut flags it so we talk it over instead of quietly losing a good source."                                                                                                               |
| 1:45–2:00 | Back to **Library** → **Export** → **LaTeX** `.tex` download (or **Copy** next to "Cite everything") → show the file.                                                                           | "And here's my bibliography. Every entry came from the DOI registry, not from the model. Claude never writes a citation. Swipe right on research."                                                                                                   |

## If you have extra time (or the judges ask)

- **Insight toast (needs ≥ 8 swipes).** Keep skipping reviews: in the demo set that's the
  "umbrella review" and "scoping review" cards. After 3 skips you get _"You keep skipping
  reviews. Hide them?"_. Press **Hide them** and a "Hiding reviews" chip appears above the deck.
- **How your papers connect** (Library). Press **Show how these connect**; it takes 10–30 s, so
  start it _before_ you talk. It shows claims under debate, shared methods and pairs to read side
  by side.
- **Accessibility.** On the deck, press **Voice control** and say "save" or "read" (use
  headphones). Or open **Display settings** → **High contrast** / **Larger text**. Everything
  works by keyboard: ← → ↑ Z.
- **Credibility formula.** Citations per year (40), peer review (30), venue type (15), recency (15).

## Answers to likely questions

- **"Does Claude hallucinate papers?"** No. Search results come from OpenAlex and Semantic
  Scholar. Claude only sees ids it's been given, any unknown id is discarded, and every answer is
  validated JSON with word limits. BibTeX comes from doi.org.
- **"What does Claude actually do?"**
  - It reads the brief and extracts the claims.
  - It writes the per-paper analysis against those claims (streamed, with the project context
    prompt-cached).
  - It finds relations across your library.
  - It phrases the swipe insights.

  Ranking and credibility are plain code.

- **"Why swiping?"** You make a quick call on each paper, the deck learns from those calls, and
  it works one-handed on a phone.
- **"Privacy?"** Guests are anonymous, and briefs sit in a private storage bucket that only project members can read.

## If something breaks

| Problem                            | Do                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brief parse spins > 20 s or errors | Press the continue button under the error. It retries from the question alone, and if that fails too, it opens the deck without claims. Or go straight to **Open demo project**. |
| Cards stuck on skeletons           | Go to `/app` → **Open demo project** (20 papers already analysed) and carry on from "swipe 5".                                                                                   |
| Phone can't join                   | Type the code at `/app/join`. Or switch to the demo project and join with `DEMO42`.                                                                                              |
| No disagreement shows              | The phone must **skip** a paper the laptop **saved**. Do it on the group page with **Skip it after all**.                                                                        |
