# AI-01 Client Wrapper Implementation Plan

**Goal:** `askJson({ tier, schema, system, messages })` → zod-validated data or a typed error; env models, SDK retries, one repair retry, refusal fallback where supported, optional prompt caching.

**Spec:** `docs/specs/2026-10-15-ai-01-client-wrapper.md`

## Constraints

- Owned paths: `src/lib/ai` (AI workstream; claimed by Mr-Moody, listed owner Dev A — say so in the PR). No contract, dep or env-schema changes (`@anthropic-ai/sdk`, `zod`, `server-only` and the `ANTHROPIC_*` vars already exist).
- Env only via `src/lib/env.ts`; key never logged.
- SDK types and helpers only (`Anthropic.Beta.*`, `zodOutputFormat`); typed SDK errors, no string matching.
- Commits `type(ai): lowercase summary`.

## Tasks

- [ ] **1. `errors.ts` + `schemas.ts` (TDD).** `words(max)`, `notStated(max)`, `NOT_STATED`; error classes. Check: `pnpm test ai`.
- [ ] **2. `json.ts` (TDD).** Fake client tests first (cases in the spec), then `generateJson(client, model, options)`. Check: `pnpm test ai`.
- [ ] **3. `client.ts`.** `server-only`, lazy `Anthropic` client, `modelFor(tier)`, `askJson`. Check: `pnpm typecheck`; `askJson` without a key throws `AiConfigError`.
- [ ] **4. Live smoke (only if a key is available).** Tiny schema against both tiers.
- [ ] **5. Review + ship.** `pr-reviewer`; `pnpm check && pnpm build`; ask before opening the PR.
