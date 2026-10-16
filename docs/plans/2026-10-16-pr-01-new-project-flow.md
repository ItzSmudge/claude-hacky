# PR-01 New Project Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/app`, a student writes a question, optionally attaches a brief, reviews the parsed topic and claims, and lands on the deck. The context they approve is the one the cards use.

**Architecture:** Two calls to the server:

- **`POST /api/projects`** (JSON) creates the project.
- **`POST /api/projects/[projectId]/context`** (multipart, file optional) uploads the brief, calls `parseBrief` (AI-02) and returns the context **without saving it**.

The client's review step saves the approved context with the existing `PATCH /api/projects/[projectId]`, then opens the deck. Pure helpers hold every decision that can be tested. The UI is one client component that moves through a few states.

**Tech Stack:** Next.js 16.4 App Router route handlers, Supabase (server client with RLS, Storage bucket `briefs`), zod, `@/lib/ai` (`parseBrief`), shadcn radix-nova primitives (`Button`, `Textarea`, `Input`, `Badge`, `Skeleton`), Tailwind v4 tokens, `motion`, vitest.

**Spec:** `docs/specs/2026-10-16-pr-01-new-project-flow.md`

## Global Constraints

- **Owned paths only:** `src/app/app/page.tsx`, `src/components/projects/**`, `src/app/api/projects/**`. No contract, dependency or migration changes.
- **Brief upload limit:** **4 MB** (`4 * 1024 * 1024`), checked in the browser and on the server. Over the limit the copy is exactly "Briefs can be up to 4 MB. Try the Word or text version."
- **Accepted brief files:** `.pdf`, `.docx`, `.txt`, `.md`.
- **Question:** required, at most 2,000 characters. Validated with `createProjectRequestSchema`.
- **Title:** the question cut to at most 80 characters at a word boundary. On **Start swiping** it is replaced by the reviewed topic.
- **Claims:** at most 6. Empty claims are dropped. Ids are renumbered `c1…cn` in the order shown.
- **Context route:** `maxDuration = 120`, and it calls `parseBrief` with `signal: AbortSignal.timeout(110_000)`. It never writes `projects.context`.
- **Storage path:** `briefs/<projectId>/<random>-<safe filename>`. The content type comes from `resolveBriefKind`.
- **Error mapping:**
  - `BriefInputError` → 400 `{ error: message }`
  - `AiConfigError` → 503
  - `AiRefusalError` / `AiOutputError` / any other parse failure → 502
  - not the owner → 403, missing project → 404, no session → 401
  - the uploaded file is removed if parsing fails
- **Copy, fixed by the spec:**
  - "What are you researching?"
  - "Brief or marking rubric (optional)"
  - the button: **Read my brief** with a file, **Start project** without one
  - "Reading your brief…" with a file, "Working out what to look for…" without one
  - "Here's what we found"
  - **Add a claim**, **Start swiping**
  - "Couldn't read that right now."
  - **Try again**, **Continue with just my question**
  - **Choose another file**, **Continue without the brief**
- **Design and accessibility:**
  - design-system tokens only, no hex values in `.tsx`
  - a paper card (`rounded-2xl shadow-paper bg-card`), with the summary in the `bg-highlight` strip
  - light, dark and high-contrast themes
  - tap targets at least 44 px (`min-h-11`)
  - `aria-live="polite"` status
  - focus moves to the review heading
  - the one stagger animation is disabled under reduced motion
- **Done means:** `pnpm check && pnpm build` pass.

## Review Focus

1. **A file input with nothing chosen** submits an empty `File` (name `""`, size 0). It should count as no brief: no upload, and `parseBrief` gets no `brief`. Pinned in Task 3.
2. **Filenames with path characters, spaces, accents or great length** (`../Brief (final) é.docx`) should produce a safe storage key under `briefs/<projectId>/`. Pinned in Task 1.
3. **A whitespace-only question** should be blocked in the browser, and get a 400 from `POST /api/projects`. Pinned in Task 2, plus a manual check in Task 4.
4. **A project member who isn't the owner** calling the context route should get a 403, with nothing uploaded or parsed. Pinned in Task 3.
5. **Submitting before the anonymous session exists** (first visit on slow Wi-Fi) should create the project, not fail with a 401. The client awaits `ensureAnonymousSession()` before the first POST. Pinned in Task 4's manual check.

---

## File structure

| File                                                                       | Action        | Responsibility                                                                     |
| -------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `src/components/projects/new-project.ts` (+ `.test.ts`)                    | create        | Client-safe pure helpers: title, file check, draft ↔ context, error kinds          |
| `src/app/api/projects/route.ts` (+ `route.test.ts`)                        | modify/create | `POST` creates a project                                                           |
| `src/app/api/projects/[projectId]/authorise.ts`                            | create        | `authorise` and `error` moved out of `[projectId]/route.ts`, shared by both routes |
| `src/app/api/projects/[projectId]/route.ts`                                | modify        | Imports `authorise` / `error` instead of defining them                             |
| `src/app/api/projects/[projectId]/context/brief-storage.ts` (+ `.test.ts`) | create        | Storage path, error → HTTP mapping                                                 |
| `src/app/api/projects/[projectId]/context/route.ts` (+ `route.test.ts`)    | create        | `POST` uploads, parses, returns context                                            |
| `src/components/projects/new-project-card.tsx`                             | create        | The client UI: form → creating → reading → review → error                          |
| `src/app/app/page.tsx`                                                     | modify        | Renders the card above the demo and join links                                     |

---

### Task 1: Pure helpers

**Files:**

- Create: `src/components/projects/new-project.ts` and `src/components/projects/new-project.test.ts`
- Create: `src/app/api/projects/[projectId]/context/brief-storage.ts` and `brief-storage.test.ts`

**Interfaces:**

- **Produces, in `new-project.ts`** (no server-only imports):
  - `MAX_UPLOAD_BYTES = 4 * 1024 * 1024`
  - `ACCEPTED_BRIEF = ".pdf,.docx,.txt,.md"`
  - `MAX_CLAIMS = 6`
  - `TOO_LARGE_MESSAGE = "Briefs can be up to 4 MB. Try the Word or text version."`
  - `titleFromQuestion(question: string): string`
  - `checkBriefFile(file: { name: string; size: number }): string | null`, which returns an error message or `null`
  - `interface ReviewDraft { topic: string; summary: string; claims: string[]; themes: string[]; constraints: string[] }`
  - `draftFromContext(context: ProjectContext): ReviewDraft`
  - `contextFromDraft(draft: ReviewDraft): ProjectContext`
  - `failureKind(status: number): "file" | "ai"`
- **Produces, in `brief-storage.ts`** (server):
  - `briefStoragePath(projectId: string, filename: string, random: string): string`
  - `contextErrorStatus(error: unknown): { status: 400 | 502 | 503; message: string }`

- [ ] **Step 1: Write the failing tests.**

`new-project.test.ts`:

```ts
describe("titleFromQuestion", () => {
  it("keeps a short question, tidied", () =>
    expect(titleFromQuestion("  Does sleep   matter? ")).toBe("Does sleep matter?"));
  it("cuts long questions at a word boundary within 80 characters", () => {
    const title = titleFromQuestion("word ".repeat(40));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });
  it("hard-cuts a single word longer than 80", () =>
    expect(titleFromQuestion("x".repeat(120)).length).toBeLessThanOrEqual(80));
});

describe("checkBriefFile", () => {
  it.each(["brief.pdf", "Brief.DOCX", "notes.md", "a.txt"])("accepts %s", (name) =>
    expect(checkBriefFile({ name, size: 1000 })).toBeNull(),
  );
  it("rejects files over 4 MB with the spec's copy", () =>
    expect(checkBriefFile({ name: "b.pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe(TOO_LARGE_MESSAGE));
  it.each(["scan.png", "brief.doc", "brief"])("rejects %s", (name) =>
    expect(checkBriefFile({ name, size: 10 })).toMatch(/PDF, Word \(\.docx\) or text/),
  );
});

describe("draft ↔ context", () => {
  it("round-trips the fixture context", () =>
    expect(contextFromDraft(draftFromContext(fixtureProject.context))).toEqual(
      fixtureProject.context,
    ));
  it("drops empty claims and renumbers ids in order", () => {
    const draft = { ...draftFromContext(fixtureProject.context), claims: ["B", "  ", "A"] };
    expect(contextFromDraft(draft).claims).toEqual([
      { id: "c1", text: "B" },
      { id: "c2", text: "A" },
    ]);
  });
  it("keeps at most MAX_CLAIMS claims", () => {
    const draft = { ...draftFromContext(fixtureProject.context), claims: Array(8).fill("x") };
    expect(contextFromDraft(draft).claims).toHaveLength(MAX_CLAIMS);
  });
  it("passes projectContextSchema", () =>
    expect(
      projectContextSchema.safeParse(contextFromDraft(draftFromContext(fixtureProject.context)))
        .success,
    ).toBe(true));
});

describe("failureKind", () => {
  it("treats 400 as a file problem", () => expect(failureKind(400)).toBe("file"));
  it.each([401, 500, 502, 503, 504])("treats %i as an AI problem", (s) =>
    expect(failureKind(s)).toBe("ai"),
  );
});
```

`brief-storage.test.ts` mocks `server-only`:

```ts
describe("briefStoragePath", () => {
  it("prefixes the project and random id", () =>
    expect(briefStoragePath(PID, "brief.docx", "r4nd")).toBe(`${PID}/r4nd-brief.docx`));
  it("makes hostile names safe", () => {
    const path = briefStoragePath(PID, "../Brief (final) é.docx", "r");
    expect(path.startsWith(`${PID}/r-`)).toBe(true);
    expect(path.slice(PID.length + 1)).toMatch(/^[a-z0-9._-]+$/);
    expect(path).not.toContain("..");
    expect(path.endsWith(".docx")).toBe(true);
  });
  it("caps very long names", () =>
    expect(briefStoragePath(PID, `${"a".repeat(300)}.pdf`, "r").length).toBeLessThanOrEqual(
      PID.length + 1 + 100,
    ));
});

describe("contextErrorStatus", () => {
  it("maps BriefInputError to 400 with its message", () =>
    expect(contextErrorStatus(new BriefInputError("unreadable", "Nope."))).toEqual({
      status: 400,
      message: "Nope.",
    }));
  it("maps AiConfigError to 503", () =>
    expect(contextErrorStatus(new AiConfigError("x")).status).toBe(503));
  it.each([new AiOutputError("invalid"), new AiRefusalError(null, null), new Error("boom")])(
    "maps %s to 502",
    (e) => expect(contextErrorStatus(e).status).toBe(502),
  );
});
```

`PID` is `fixtureProject.id`. Import the error classes from `@/lib/ai`.

- [ ] **Step 2: Run the tests and watch them fail.**
      Run: `pnpm vitest run src/components/projects/new-project.test.ts "src/app/api/projects/[projectId]/context/brief-storage.test.ts"`
      Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement both modules.**

  `new-project.ts`:
  - **Title:** trim and collapse whitespace. If longer than 80 characters, cut at the last space at or before 79, then add `…`.
  - **File check:** check the extension, then the size. An unsupported file gets "Upload a PDF, Word (.docx) or text file."
  - **`draftFromContext`:** copies the arrays.
  - **`contextFromDraft`:** trims every field, drops empty claims, themes and constraints, keeps the first `MAX_CLAIMS`, and assigns ids `c${i+1}`.

  `brief-storage.ts`:
  - imports `server-only`
  - **safe name:** lowercase, NFKD with accents removed, anything outside `[a-z0-9._-]` becomes `-`, runs of dots and dashes are collapsed, leading dots are removed, and the stem is capped so the whole name is at most 100 characters with the extension kept
  - **errors:** `instanceof` checks for each class
  - the 502 message is "Couldn't read that right now."
  - the 503 message is "Brief reading isn't set up on this server."

- [ ] **Step 4: Run the tests and watch them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**
      `git add src/components/projects/new-project.* "src/app/api/projects/[projectId]/context/brief-storage."* && git commit -m "feat(projects): add new project helpers"`

---

### Task 2: `POST /api/projects`

**Files:**

- Modify: `src/app/api/projects/route.ts` (replace the `notImplemented("PR-01")` POST)
- Create: `src/app/api/projects/route.test.ts`

**Interfaces:**

- Consumes:
  - `createProjectRequestSchema`, `Project` and `ApiError` from `@/lib/api-schemas`
  - `PROJECT_COLUMNS` and `toProject` from `@/components/projects/project-list`
  - `getSupabaseServerClient`
- Produces: `POST(request: Request): Promise<Response>`, which returns `201 Project`. Task 4 consumes it.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/supabase/server` the way `src/app/api/analyse/route.test.ts` does. The builder records `insert(row)` and returns `{ data, error }` from `.select().single()`.

```ts
it("returns 401 without a session", async () => {
  db.userId = undefined;
  expect((await post({ title: "T", query: "Q" })).status).toBe(401);
});
it("returns 400 for a blank question", async () =>
  expect((await post({ title: "T", query: "   " })).status).toBe(400));
it("returns 400 for a non-JSON body", async () => expect((await post("nope")).status).toBe(400));
it("inserts title and query as the user and returns 201 Project", async () => {
  const res = await post({ title: "Sleep", query: "Does sleep matter?" });
  expect(res.status).toBe(201);
  expect(db.inserts).toEqual([{ title: "Sleep", query: "Does sleep matter?" }]);
  expect(projectSchema.parse(await res.json()).id).toBe(ROW.id);
});
it("returns 500 when the insert fails", async () => {
  db.insertError = { code: "x", message: "y" };
  expect((await post({ title: "T", query: "Q" })).status).toBe(500);
});
```

`ROW` is a `projects` row built from `fixtureProject`, with an `owner_id`, `join_code` and `created_at`. The existing `GET` must keep working: the mock still has to support whatever `loadProjects` uses, or the GET tests are left out.

- [ ] **Step 2: Run the tests and watch them fail.**
      Run: `pnpm vitest run src/app/api/projects/route.test.ts`
      Expected: FAIL. The POST returns 501.

- [ ] **Step 3: Implement `POST`.**
  1. Check `getClaims()`. With no session, return 401 "Sign in to start a project".
  2. `safeParse` the JSON body against `createProjectRequestSchema`. On failure, return 400 "Invalid project" with `z.treeifyError`.
  3. Run `from("projects").insert(body).select(PROJECT_COLUMNS).single()`. On an error, return 500 "Couldn't create the project".
  4. Return `NextResponse.json<Project>(toProject(data), { status: 201 })`.
  5. Remove the now-unused `notImplemented` import.

- [ ] **Step 4: Run the tests and watch them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(projects): create projects from the api"`

---

### Task 3: `POST /api/projects/[projectId]/context`

**Files:**

- Create: `src/app/api/projects/[projectId]/authorise.ts`. Move `authorise` and `error` here verbatim, typed with `RouteContext<"/api/projects/[projectId]">`. The context route passes a context whose `params` has the same shape: type it as `{ params: Promise<{ projectId: string }> }`.
- Modify: `src/app/api/projects/[projectId]/route.ts`, so it imports both from `./authorise`.
- Create: `src/app/api/projects/[projectId]/context/route.ts` and `route.test.ts`

**Interfaces:**

- Consumes:
  - `authorise` and `error` from `../authorise`
  - `briefStoragePath` and `contextErrorStatus` from Task 1
  - `MAX_UPLOAD_BYTES` from `@/components/projects/new-project`
  - `parseBrief` from `@/lib/ai`
  - `resolveBriefKind` from `@/lib/ai/brief-input`
- Produces:
  - `POST(request: Request, ctx: RouteContext<"/api/projects/[projectId]/context">): Promise<Response>`, which returns `200 { context: ProjectContext }`
  - `export const maxDuration = 120`

- [ ] **Step 1: Write the failing tests.**
  - **Mock `@/lib/supabase/server`:**
    - `getClaims`
    - `from("projects")…maybeSingle()` returns `{ id, owner_id, query }`
    - `from("project_documents").insert(row)` records `row`
    - `storage.from("briefs").upload(path, data, opts)` and `.remove([path])` record their calls
  - **Mock `@/lib/ai`:** `parseBrief`, plus the real error classes via `vi.importActual`.
  - **Build requests** with `new Request(url, { method: "POST", body: formData })`, where `formData` optionally has `brief` set to `new File([bytes], name, { type })`.

```ts
it("returns 401 / 400 bad id / 404 / 403 for a member who isn't the owner, without uploading or parsing", …);
it("parses the question alone when no file is sent, and saves nothing", async () => {
  const res = await post(PID, new FormData());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ context: CONTEXT });
  expect(parseBrief).toHaveBeenCalledWith(expect.objectContaining({ query: QUERY, brief: undefined }));
  expect(db.uploads).toEqual([]); expect(db.documents).toEqual([]); expect(db.projectUpdates).toEqual([]);
});
it("treats an empty file input as no brief", …); // brief = new File([], "") → same assertions as above
it("uploads the brief, parses it and records the document", async () => {
  // brief.docx, DOCX MIME, 3 bytes; parseBrief resolves { context: CONTEXT, extractedText: "text" }
  expect(db.uploads[0].path).toMatch(new RegExp(`^${PID}/[\\w-]+-brief\\.docx$`));
  expect(db.uploads[0].opts.contentType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  expect(parseBrief.mock.calls[0][0].brief).toMatchObject({ filename: "brief.docx", mimeType: DOCX });
  expect(db.documents).toEqual([{ project_id: PID, storage_path: db.uploads[0].path, filename: "brief.docx", extracted_text: "text" }]);
});
it("rejects files over 4 MB with 400 before uploading", …);
it("rejects an unsupported file with 400 before uploading", …); // scan.png
it.each([
  [new BriefInputError("unreadable", "Can't read it."), 400],
  [new AiConfigError("no key"), 503],
  [new AiOutputError("invalid"), 502],
])("maps %s to %i and removes the uploaded file", async (err, status) => {
  parseBrief.mockRejectedValueOnce(err);
  const res = await post(PID, withBrief("brief.pdf", "application/pdf"));
  expect(res.status).toBe(status);
  expect(db.removed).toEqual([db.uploads[0].path]);
});
it("returns 500 when the upload fails, without parsing", …);
```

- [ ] **Step 2: Run the tests and watch them fail.**
      Run: `pnpm vitest run "src/app/api/projects/[projectId]"`
      Expected: the new context tests FAIL because the route can't be resolved. The PATCH and DELETE routes have no tests, so they're checked by `pnpm typecheck`.

- [ ] **Step 3: Move `authorise` / `error` into `authorise.ts`,** and import them in `[projectId]/route.ts`. Run `pnpm typecheck`. Expected: clean.

- [ ] **Step 4: Implement the context route.** In order:
  1. `authorise(ctx)`. If the caller isn't the owner, return 403 "Only the project owner can set up the brief". Select `query` too: extend the select, or do a second read in the route.
  2. `request.formData()`. A failure returns 400.
  3. `brief = form.get("brief")`. It's a file only if it's a `File` with `size > 0`.
  4. If it's over `MAX_UPLOAD_BYTES`, return 400 with `TOO_LARGE_MESSAGE`.
  5. `resolveBriefKind` → its MIME type. A thrown `BriefInputError` returns 400.
  6. Upload to `briefStoragePath(id, name, crypto.randomUUID())` with that `contentType`. An error returns 500 "Couldn't save your brief".
  7. Call `parseBrief({ query, brief: file && { data, mimeType, filename }, signal: AbortSignal.timeout(110_000) })`.
  8. If parsing throws, remove the upload (ignore any remove error) and return `contextErrorStatus`. Log the class name only, never the brief text.
  9. If there was a file, insert the `project_documents` row. An insert error is logged but doesn't fail the response.
  10. Return `200 { context }`.

  The route never updates `projects`.

- [ ] **Step 5: Run the tests and watch them pass.**
      Run: `pnpm vitest run src/app/api/projects src/components/projects`
      Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -m "feat(projects): read briefs into project context"`

---

### Task 4: New project card on `/app`

**Files:**

- Create: `src/components/projects/new-project-card.tsx` (`"use client"`)
- Modify: `src/app/app/page.tsx`

**Interfaces:**

- Consumes:
  - Task 1's helpers
  - `ensureAnonymousSession` from `./ensure-session`
  - `POST /api/projects` → `Project`
  - `POST /api/projects/[id]/context` → `{ context }`, or `ApiError` with a status
  - `PATCH /api/projects/[id]` with `{ title, context }`
- Produces: `NewProjectCard(): JSX.Element`.

- [ ] **Step 1: Build the card** as a `useReducer` / `useState` state machine with these phases:
  - `form`
  - `creating`
  - `reading`
  - `review` (`{ project, draft }`)
  - `failed` (`{ project, kind: "file" | "ai", message }`)

  The flow:
  1. **Submit.** If the question is blank, show an inline error and stop.
  2. Run `checkBriefFile`. On an error, show it inline and stop.
  3. `await ensureAnonymousSession()`. If it returns `"failed"`, stop; the toast has already been shown.
  4. `POST /api/projects` with `{ title: titleFromQuestion(q), query: q }`.
  5. Send a `FormData` (with `brief` if a file is chosen) to `/context`.
  6. On a 200, go to `review` with `draftFromContext`. Otherwise go to `failed` with `failureKind(status)` and the server's `error` message.

  What each phase does:
  - **Try again** re-runs step 5 only.
  - **Continue without the brief** re-runs step 5 with no file.
  - **Continue with just my question** goes to `/app/p/${id}` without a PATCH.
  - **Choose another file** goes back to `form` with the question kept and the existing project reused, so no second POST.
  - **Start swiping** sends the PATCH with `{ title: draft.topic.trim() || titleFromQuestion(q), context: contextFromDraft(draft) }`, then `router.push(`/app/p/${id}`)` and `router.refresh()`. A PATCH failure shows a toast and stays on the review step.
  - **Review step:**
    - the topic is an `Input`
    - the summary sits in the `bg-highlight` strip and is hidden when it's "not stated"
    - each claim is a `Textarea` with an aria-labelled remove button
    - **Add a claim** is disabled at `MAX_CLAIMS`
    - themes and constraints are `Badge`s, each with an aria-labelled remove button
    - the claims stagger in with `motion` and `useReducedMotion()`, with no animation when motion is reduced
    - the heading takes focus (`tabIndex={-1}`, focused on entering `review`)
  - **Status:** one `aria-live="polite"` region shows the reading copy. Skeleton lines show while `reading`. The buttons are disabled while busy.

- [ ] **Step 2: Update `page.tsx`.** Render `<NewProjectCard />` first. Keep `OpenDemoButton` and the join link underneath. Remove the styleguide link and the "until that flow lands" copy. The page stays a server component, and the card is the client island.

- [ ] **Step 3: Check it by hand in the real app.** Use the `run-app` skill, at phone size, in both light and dark themes. Check:
  1. A DOCX brief goes through review to the deck, and the claims appear on the cards.
  2. A PDF brief.
  3. No file.
  4. A `.png`: the inline error, then **Continue without the brief**.
  5. A blank question is blocked.
  6. A fresh incognito visit (no session) creates the project.
  7. Double-tapping **Start project** creates one project. Check the sidebar.
  8. Keyboard only: Tab through the flow, and focus lands on "Here's what we found".
  9. With the API key unset, the AI failure path appears, and **Continue with just my question** works.

  Save screenshots for the PR.

- [ ] **Step 4: Commit.** `git commit -m "feat(projects): add the new project flow to /app"`

---

### Task 5: Verify and hand off

- [ ] **Step 1:** `pnpm check && pnpm build`. Expected: exit 0.
- [ ] **Step 2:** `grep -rE "#[0-9a-fA-F]{6}" src/components src/app --include=*.tsx`. Expected: no output.
- [ ] **Step 3:** Run the `a11y-reviewer` and `pr-reviewer` agents, plus the whole-branch review. Fix any Critical or Important findings, then `/ship-pr`.
