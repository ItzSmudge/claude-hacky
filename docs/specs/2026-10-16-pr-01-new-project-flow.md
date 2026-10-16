# PR-01 — New project flow

**Goal.** A student starts a project from `/app`: they write their question, optionally attach the brief or marking rubric, and watch PaperCut read it back as a topic plus claims to test. They correct the claims, then start swiping. This is step 02 of the live demo ("Upload a brief — Claude turns it into project context"). It is the moment judges see that the deck understood the assignment before showing any papers.

**Why it matters.** Every card's "why it matters", relevance and stance chips are written against `project.context` (AI-03). Without this flow, only the seeded demo project has a context.

## Goals / non-goals

- **Goal:** under a minute from an empty `/app` to the deck, on a phone, with a real brief.
- **Goal:** the claims the student approves are the claims the cards use.
- **Non-goal:**
  - editing the context later from the project page
  - more than one file per project
  - re-parsing on edit
  - Google sign-in (PR-03)
- **Anti-goal:** the flow must not dead-end. If the brief can't be read or the AI call fails, the student still reaches the deck with their question, and nothing is lost.

## User flow

1. **`/app` start card.** This replaces today's "until that flow lands" copy. It's a single paper index card:
   - **"What are you researching?"** A textarea, required, at most 2,000 characters. The placeholder is the kind of question a student would ask.
   - **"Brief or marking rubric (optional)"** A file picker with a drop zone. It accepts `.pdf`, `.docx`, `.txt` and `.md`, up to **4 MB**, checked in the browser first. Vercel rejects function request bodies over about 4.5 MB, so the 4 MB cap is the product limit, even though `parseBrief` and the bucket allow 10 MB. Over the cap, the message is "Briefs can be up to 4 MB. Try the Word or text version." The route checks the size too, and returns 400.
   - **One primary button.** It reads **Read my brief** when a file is attached and **Start project** when not.
   - Underneath the card stay the existing "Open the demo project" button and "Join their project" link. The styleguide link is removed from this page.
2. **Creating** (well under a second): `POST /api/projects` with JSON `{ title, query }`. The title is the question cut to 80 characters at a word boundary.
3. **Reading** (about 4–15 s): `POST /api/projects/[id]/context`, multipart, with the `brief` file optional. Even without a file this still runs, because `parseBrief` builds claims from the question alone.
   - The card shows "Reading your brief…" (or "Working out what to look for…" when there's no file), with skeleton lines where the claims will appear.
   - The status is announced through `aria-live="polite"`. The button is disabled to prevent double submits.
4. **Review: "Here's what we found"**, on the same card:
   - **Topic:** an editable input.
   - **Summary:** read-only text, hidden if it's "not stated".
   - **Claims to test:** one input per claim, each with a remove button, plus **Add a claim** up to 6 claims. Empty claims are dropped on save, and ids are re-numbered `c1…cn` in the order shown.
   - **Themes and constraints:** removable chips. Chips can't be added.
   - The claims appear with a short stagger animation. This is the page's one animation, and it's off under reduced motion.
   - Focus moves to the "Here's what we found" heading.
5. **Start swiping:** `PATCH /api/projects/[id]` with `{ title: topic, context }`, using the existing route. Then navigate to `/app/p/[id]` and `router.refresh()`, so the history sidebar lists the new project.

## Server

- **`POST /api/projects`** (replaces the 501 placeholder):
  - The body is validated with `createProjectRequestSchema`.
  - The row is inserted as the user, with RLS applied. Owner membership and the join code come from database defaults and triggers.
  - Returns `201 Project`.
  - **401** if there's no session. `/app` already creates an anonymous session through `EnsureSession`.
- **`POST /api/projects/[projectId]/context`** (new, owner only, `maxDuration = 120`):
  1. Reads the multipart `brief` file, if present.
  2. Uploads it to `briefs/<projectId>/<random>-<safe filename>` as the user. The content type comes from `resolveBriefKind`, because browsers send unreliable MIME types for `.md`.
  3. Calls `parseBrief({ query: project.query, brief, signal: AbortSignal.timeout(110_000) })`.
  4. Inserts a `project_documents` row (`storage_path`, `filename`, `extracted_text`). This only happens when there's a file, because `storage_path` can't be null.
  5. Returns `200 { context }` **without saving it**. The context is saved only by the PATCH on **Start swiping**, so the cards never use claims the student didn't approve. If the tab is closed during review, `context` stays null and the deck falls back to the question. _(builder's call)_
- **Error responses** use `apiErrorSchema`:
  - `BriefInputError` → **400** `{ error: message }`.
  - `AiConfigError` → **503**.
  - `AiRefusalError` / `AiOutputError` / API errors → **502**.
  - Not the owner → **403**. Missing → **404**. Both reuse the `authorise` helper from `[projectId]/route.ts`. Anonymous users have the `authenticated` role, so RLS already allows them to create projects and upload.
  - The uploaded file is removed again if parsing fails.

## Errors in the UI (the question is always kept)

- **Bad file** (400, or the browser-side check fails):
  - An inline error under the file field, using the server's message.
  - Actions: **Choose another file**, or **Continue without the brief**, which re-runs the context call with no file.
- **AI unavailable** (502/503 or timeout): "Couldn't read that right now." The actions are:
  - **Try again**, which repeats the same call. The project already exists.
  - **Continue with just my question**, which goes straight to the deck with `context` left null. The deck already falls back to the title and query.
- **Session failure** is already handled with a toast by `EnsureSession`.

## Design

- Uses the design-system tokens only.
- The card is a paper index card (`rounded-2xl`, `shadow-paper`, `bg-card`). The review step's summary sits in the `bg-highlight` "why it matters" strip, so it echoes the swipe card.
- Fraunces for headings, Inter for UI.
- Works in light and dark themes, and with high contrast.
- Full width on phones, with tap targets at least 44 px.
- Copy follows the slides: "Start a project for your assignment", "brief or marking rubric".

## Owned paths

All changes go in:

- `src/app/app/page.tsx`
- `src/components/projects/**`
- `src/app/api/projects/**`

No contract, dependency or migration changes.

## Testing

- **TDD for pure logic:**
  - the title-from-question helper
  - the review-state helpers (edit, remove and add claims; dropping empties; re-numbering ids; removing chips)
  - mapping errors to HTTP statuses
- **Route handlers:** test them in the style of the existing route tests where practical.
- **End to end:** run the real flow locally on a phone-sized screen in both themes. Include a DOCX, a PDF, no file, and a `.png` to trigger the rejection.

## Out of scope

- Brief editing after the deck opens
- Rubric-specific parsing
- Multiple files
- Drag-to-reorder claims
- Adding themes or constraints
