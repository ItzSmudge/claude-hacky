# AI-04 Analyse Route Implementation Plan

**Goal:** `POST /api/analyse` streams NDJSON `AnalyseStreamEvent`s.

- Analyses already saved for the project come back immediately.
- New ones come from `analysePaper()`, at most 5 at a time, each emitted as it finishes.
- Each new analysis is saved to `paper_analyses` with credibility computed in code.

**Spec:** `docs/specs/2026-10-16-ai-04-analyse-route.md`

**Start condition:** PR #30 (AI-03) is merged into `dev`. Then `git merge origin/dev` here before step 1.

## Constraints

- **Owned paths:** `src/lib/ai`, `src/app/api/analyse`. The AI workstream's listed owner is Dev A; Mr-Moody claimed this task.
- **Frozen contracts:** `analyseRequestSchema` and `analyseStreamEventSchema` are used as they are. No migrations; `paper_analyses` and its member RLS policies already exist.
- **Clients:** the user's RLS client (`getSupabaseServerClient`) for project, analyses and papers. No admin client.
- **No secrets in logs.** Error messages sent to the client are generic.
- **Commits:** `type(ai): lowercase summary`.

## Tasks

- [x] **1. `analyse-batch.ts` (TDD).**
  - `analyseBatch({ projectId, paperIds, context, deps, signal })` is an async generator. It:
    - dedupes ids;
    - emits valid saved rows first;
    - emits "Paper not found" for ids with no cached paper;
    - runs `deps.analyse` through a pool of 5 and yields each result as it settles;
    - maps errors per the spec table;
    - calls `deps.save` without letting a save failure block the stream;
    - yields `done` last.
  - Tests use fakes and check:
    - order;
    - the in-flight limit;
    - error isolation;
    - an invalid saved row is re-analysed;
    - abort reports the remaining papers as busy.
  - Check: `pnpm test src/lib/ai`.
- [x] **2. ~~`analyse-stream.ts` (TDD).~~** Built, then dropped: SW-04 (#32) shipped its own reader in `src/components/swipe/analyse-stream.ts`.
  - `readAnalyseStream(body)` handles lines split across chunks and a trailing line with no newline. It skips blank and invalid lines, parsing each line with `analyseStreamEventSchema`.
  - Make sure `src/lib/ai/index.ts` (server-only) doesn't re-export it.
- [x] **3. Route `src/app/api/analyse/route.ts`.**
  - Auth (401), then parse (400), then project lookup (404), with a context fallback when the project has no brief.
  - Supabase deps:
    - `paper_analyses` select and upsert, the upsert using `computeCredibility`;
    - `papers` select, with `data` parsed by `paperSchema`.
  - `ReadableStream` NDJSON with `Content-Type: application/x-ndjson`, `Cache-Control: no-store`, `maxDuration = 60`, and a 55 s `AbortSignal.any` deadline.
  - Route test with `@/lib/supabase/server` and `@/lib/ai` mocked: 401, 400, 404, and a happy-path stream whose every line parses with `analyseStreamEventSchema`.
- [ ] **4. Manual check (needs `pnpm db:start` + `ANTHROPIC_API_KEY`).**
  - Sign in as the demo user and POST 3 fixture paper ids for the demo project.
  - Expect 3 analysis events, then `done`, and rows in `paper_analyses`.
  - A second POST should be instant (served from the cache).
  - Without a key, expect "AI isn't configured" error events.
- [x] **5. Review + ship.**
  - `pr-reviewer`, then `pnpm check && pnpm build`.
  - `/ship-pr` into `dev`, ticking AI-04.
