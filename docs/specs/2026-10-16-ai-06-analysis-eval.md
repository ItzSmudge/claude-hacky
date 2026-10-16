# AI-06 — Paper analysis eval

**Goal:** evidence that the card text Claude writes (AI-03) invents no bibliographic data and handles a missing abstract correctly, as a repeatable check the team can quote in the demo ("10/10 cards, zero invented citations").

**Why code checks, not the schema:** `paperAnalysisOutputSchema` already enforces word limits and bans URLs/DOIs, and `askJson` repairs once, so those can never reach a card. What zod can't see is bibliographic data written as plain words: an author's name, a year, another paper's title, "et al.", or an invented number. This eval looks for those.

## Units

- **`checkAnalysis(paper, analysis, { others, context })`** in `src/lib/ai/eval.ts`. Pure, with no API calls. Returns `{ failures: string[], warnings: string[] }`. Built test-first with hand-written analyses.
- **`src/lib/ai/paper-analysis.eval.live.test.ts`**, opt-in like the other `*.live.test.ts`, run with `AI_LIVE=1`:
  - runs `analysePaper()` (the FAST model) on the first **10 fixture papers**, plus **one copy of the first paper with `abstract` removed**, against `fixtureProject.context`;
  - prints a results table;
  - **fails if any paper has a failure**;
  - is skipped in `pnpm check` and CI.

```
AI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/paper-analysis.eval.live.test.ts
```

## Checks

The text fields are `overview`, `whyItMatters`, `relevanceReason`, `methodology`, `limitations` and every stance `note`. "Source" means the paper's title, abstract, venue, topics and year as sent in the prompt. Matching is case-insensitive.

**Failures:**

1. A URL or DOI (same patterns as `schemas.ts`).
2. A surname of this paper's authors: the last word of each name, with 3 or more letters.
3. Another fixture paper's title, or this paper's own title, matched as any run of 6 or more consecutive words.
4. A citation pattern: `et al`, or `(Name, 19xx/20xx)` or `(Name 2020)`.
5. A year (`19xx`/`20xx`) that doesn't appear in the source.
6. Stances that don't match the brief: not exactly one per claim id in `context.claims`, in any order, or an unknown id.
7. **No-abstract paper** (`!paper.abstract`): `overview`, `methodology` and `limitations` must each be exactly `"not stated"`, and every stance must be `unclear`.

**Warnings:**

- A number (digits, including decimals and `%`) that isn't in the source, ignoring years already covered by check 5 and the relevance score.
- The response needed a repair retry (`repaired`).
- Any text field within 1 word of its schema limit.

## Output

One line per paper: id, PASS/FAIL, relevance, `repaired`, then any failures and warnings. Totals follow: papers passed, failures, warnings, repairs, and input/output/cache-read tokens. The test fails with the list of failures.

## Edge cases

- A word in the title (for example "social media") is fine, since single words aren't titles. Only runs of 6 or more words count.
- Short surnames (≤ 2 letters) and surnames that are ordinary words already in the source (for example "Young") are skipped, to avoid false alarms.
- A model error (refusal, invalid output after the repair) counts as a failure for that paper and doesn't stop the run.

## Out of scope

- Judging summary quality (that would need an LLM judge).
- Evaluating brief parsing (AI-02) or relations (AI-05).
- CI wiring, and a `package.json` script (a deps/infra change).
