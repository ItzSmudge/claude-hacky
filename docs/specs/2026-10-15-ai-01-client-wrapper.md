# AI-01 — Anthropic client wrapper

**Goal:** one small, well-tested way for every AI task (AI-02 brief parsing, AI-03 paper analysis, AI-05 relations, RK-03 insight) to ask Claude for JSON and get back a value that has passed zod validation, or a typed error. It should never return unvalidated text. Models come from env. Transient failures are retried, and one bad JSON answer gets one repair attempt.

## API (`src/lib/ai`)

```ts
// client.ts (server-only)
askJson<T>({
  tier: "fast" | "smart",              // ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL_SMART
  schema: z.ZodType<T>,                // the zod schema in schemas.ts is the contract
  system: string | TextBlockParam[],   // stable context; cached when cacheSystem is true
  messages: MessageParam[],            // the per-call input
  maxTokens?: number,                  // default 16_000
  effort?: "low" | "medium" | "high",  // model default when omitted
  cacheSystem?: boolean,               // prompt-cache the system prompt (project context)
  signal?: AbortSignal,
}): Promise<{ data: T; model: string; repaired: boolean; usage: Usage }>

// json.ts: the same function as generateJson(client, model, options), with the client injected for tests
// errors.ts: AiConfigError, AiRefusalError, AiOutputError (reason: "invalid" | "truncated")
// schemas.ts: NOT_STATED = "not stated", words(max), notStated(max). Shared zod pieces for AI-02/03/05.
```

## Behaviour

1. **Client.** `new Anthropic({ apiKey: requireServerVar("ANTHROPIC_API_KEY"), maxRetries: 3, timeout: 60s })`, created lazily and then reused.
   - A missing key throws `AiConfigError` with a readable message.
   - The SDK retries 408, 409, 429, 5xx and connection errors with backoff.
2. **JSON only.** Requests send `output_config.format = zodOutputFormat(schema)`, so the API constrains the output to the schema's JSON shape. There's no prefill and no tool forcing (both are 400s on current models).
3. **Validate.**
   - **Stop reason first.** `refusal` throws `AiRefusalError` with the category. `max_tokens` throws `AiOutputError("truncated")`.
   - **Then parse.** Join the text blocks, `JSON.parse` the result, then `schema.safeParse` it. Zod refinements such as word limits are enforced here, because JSON Schema can't express them.
4. **One repair.** If parsing or validation fails, resend the conversation with the model's own reply appended as an assistant turn. Add a user turn listing the zod issues: "Return corrected JSON only." If that fails too, throw `AiOutputError("invalid")` with the issues. `repaired: true` marks a success on the second try.
5. **Refusal fallback.** For models that support it (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-opus-5`, `claude-fable-5-1`), send the beta `fallbacks: "default"` (`server-side-fallback-2026-07-01`). A policy decline is then re-run on a fallback model inside the same call. Haiku 5.5 has no server-side fallback and goes straight to `AiRefusalError`. A text block can come after a `fallback` block; only text blocks are read.
6. **Prompt caching.** With `cacheSystem`, the last system block gets `cache_control: { type: "ephemeral" }`, so AI-03 can reuse the project context across a deck of papers.
7. **No invented scholarship.** The wrapper only returns what the schema allows. AI-03's schemas reference papers by internal id. This module adds no bibliographic fields.

## Edge cases

- **Empty text** (e.g. the content is only thinking blocks): invalid, so it goes to repair.
- **JSON wrapped in prose or code fences:** shouldn't happen with structured outputs. If it does, it's invalid and goes to repair. There's no regex scraping.
- **An abort signal:** passed through to the SDK, never retried by us.
- **A repair reply that is itself refused or truncated:** same typed errors.
- **Usage:** the two calls' token counts are summed.

## Testing

TDD in `json.test.ts` with a fake client, so no network or key is needed:

- valid on the first try
- invalid JSON, then repaired
- a zod refinement fails, then repaired
- invalid twice → `AiOutputError` with issues
- refusal → `AiRefusalError` with category
- `max_tokens` → truncated
- the request shape: output format, system cache control, fallbacks only for supported models, effort only when set
- the repair message contains the assistant reply and the issues
- usage summed

Plus tests for `schemas.ts` (`words`, `notStated`). Optional smoke script: `node scripts/ai-smoke.mjs`, only with a real key. Then `pr-reviewer` and `pnpm check && pnpm build`.

## Out of scope

Prompts and schemas for briefs, papers and relations (AI-02/03/05), streaming (AI-04), the batch API, and token counting.
