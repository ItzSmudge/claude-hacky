# AI-02 — Brief → ProjectContext

**Goal.** Turn a student's question plus an optional brief (PDF, DOCX or text) into a validated `ProjectContext` with the SMART model. The context drives relevance and stance on every card (AI-03), so claims must be testable statements taken from the brief, not invented.

**Scope.** Library only, in `src/lib/ai` (owned path). PR-01 calls it from `POST /api/projects` and owns upload, storage and DB writes.

## User flow (via PR-01)

Student types a question and optionally attaches a brief → PR-01 uploads to the `briefs` bucket → calls `parseBrief` → saves `context` on `projects` and `extractedText` on `project_documents` → shows the claims for editing.

## Interface

`src/lib/ai/brief.ts`, re-exported from `src/lib/ai/index.ts`:

```ts
parseBrief({ query: string; brief?: { data: Uint8Array; mimeType: string; filename: string }; signal?: AbortSignal })
  → Promise<{ context: ProjectContext; extractedText: string | null; usage: JsonUsage }>
```

## Inputs

A pure helper, `briefInput(brief)`, turns the brief into message content:

| Type                                | Handling                              | `extractedText` |
| ----------------------------------- | ------------------------------------- | --------------- |
| `application/pdf`                   | base64 `document` content block       | `null`          |
| DOCX (`…wordprocessingml.document`) | `mammoth.extractRawText` → text block | extracted text  |
| `text/plain`, `text/markdown`       | UTF-8 decode → text block             | decoded text    |
| none                                | the question alone                    | `null`          |

- The MIME type is resolved from `mimeType`, falling back to the filename extension (`.pdf`, `.docx`, `.txt`, `.md`), since browsers often send `application/octet-stream`.
- Text is capped at 60,000 characters, and the prompt says when it was cut off.
- Errors:
  - Other types, or a file over 10 MB (the bucket limit), throw `BriefInputError`.
  - A file that is empty or has no extractable text is treated as no brief: `extractedText` is `""` and the context comes from the question alone.

## Output

The model returns `briefContextOutputSchema`, defined in `schemas.ts`, with no links or DOIs anywhere:

- `topic`: ≤ 12 words
- `summary`: ≤ 60 words, or "not stated"
- `claims`: 0–6 strings, each ≤ 25 words
- `themes`: ≤ 8 strings, each ≤ 6 words
- `constraints`: ≤ 6 strings, each ≤ 20 words (for example date range, population, word count, required source types)

Code then builds the `ProjectContext`:

- It trims whitespace and drops case-insensitive duplicates.
- It assigns claim ids `c1…cn` in order. The model never picks ids.
- It checks the result against `projectContextSchema` before returning it.

## Prompt

- Runs on the SMART model via `askJson`, with no prompt caching (each brief is a one-off call).
- The question and the brief sit inside `<question>` / `<brief>` tags and are treated as data: any instructions inside them are ignored.
- The model must never name, cite or recommend papers, authors, venues or years of works.
- Claims are positions the student will argue or test, taken from the brief or the question. If there are none, it returns an empty list.
- Missing info is written as "not stated" in `summary`. Lists that have nothing are left empty.

## Edge cases

- **Question only, no brief:** the context comes from the question, which is the demo fallback.
- **Brief contradicts the question:** the brief wins for constraints, and the question wins for the topic.
- **Brief in another language:** the output is still written in UK English.
- **Scanned PDF with no text:** the model sees what Claude can read from it. There's no OCR step.
- **Model failures:** `AiOutputError`, `AiRefusalError` and `AiConfigError` pass through unchanged.

## Testing

Unit tests (vitest) with a mocked client cover:

- each input path, with a tiny real DOCX fixture in `src/lib/ai/__fixtures__/brief.docx`
- extension fallback
- rejecting unknown types and oversized files
- truncation
- id assignment and dedupe
- word-limit and no-links rejection in the schema
- the question-only path

`brief.live.test.ts` is an opt-in live run on the fixture question; it is skipped unless `ANTHROPIC_API_KEY` is set.

## Out of scope

- Upload, storage, DB writes and the claim-editing UI (PR-01)
- OCR
- `.doc` / `.rtf` / `.odt`
- Re-parsing on edit
- Relations (AI-05)
