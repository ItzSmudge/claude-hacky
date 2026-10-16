# AI-06 — Paper analysis eval: plan

> **For agentic workers:** use superpowers:executing-plans (or subagent-driven-development) task by task. Steps use `- [ ]`.

**Goal:** a pure `checkAnalysis()` that finds bibliographic data Claude may have invented in card text, plus an opt-in live eval over 10 fixture papers and 1 no-abstract copy.
**Architecture:** `src/lib/ai/eval.ts` holds pure checks and a report formatter, built test-first. `src/lib/ai/paper-analysis.eval.live.test.ts` calls the real `analysePaper()`, behind `AI_LIVE=1` like the other `*.live.test.ts`.
**Tech:** TypeScript, vitest 5. No new dependencies, no `package.json` change.
**Spec:** `docs/specs/2026-10-16-ai-06-analysis-eval.md`

## Global constraints

- Code checks only: no LLM judge. The checker never calls the API.
- Text fields: `overview`, `whyItMatters`, `relevanceReason`, `methodology`, `limitations` and every stance `note`. "Source" means title + abstract + venue + topics + year. Matching is case-insensitive.
- Failures are checks 1–7 from the spec. Warnings are ungrounded numbers, `repaired`, and fields within 1 word of their limit (limits: overview 35, whyItMatters 20, relevanceReason 8, methodology 15, limitations 15, note 12).
- The live eval is skipped unless `AI_LIVE=1`. It must not run in `pnpm check` or CI.
- Owned paths: `src/lib/ai/**`, plus this task's docs and checklist line.

## Review focus (inputs the spec implies but doesn't spell out)

1. **Number formatting:** the abstract has "2,109" and the output says "2109" or "2,109". Both count as grounded, so strip thousands commas before comparing. (Task 1 test.)
2. **Name particles and possessives:** "M. D. de Looze" gives the surname "Looze". "Boer's" and "BOER" both count as the surname "Boer". Hyphenated surnames are matched whole. (Task 1 test.)
3. **Punctuation inside title runs:** "Social media use intensity, social media use problems, and…" still matches when the output drops the commas. Normalise punctuation and whitespace to single spaces first. (Task 1 test.)
4. **A number that looks like a year:** "2109 adolescents" isn't a year (the regex only matches `19xx`/`20xx` as a whole word). "2010 participants" counts as a year and fails unless it's in the source. (Task 1 test.)
5. **"not stated" fields** trigger no near-limit or number warnings, and stance notes on `unclear` stances are ignored. (Task 1 test.)

---

### Task 1: `checkAnalysis` + `formatEvalReport` (pure)

**Files:** create `src/lib/ai/eval.ts` and `src/lib/ai/eval.test.ts`

**Produces:**

```ts
export interface EvalIssues {
  failures: string[];
  warnings: string[];
}
export function checkAnalysis(
  paper: Paper,
  analysis: PaperAnalysis,
  opts: { others: Paper[]; context: ProjectContext; repaired?: boolean },
): EvalIssues;
export interface EvalRow {
  paperId: string;
  relevance?: number;
  repaired: boolean;
  issues: EvalIssues;
  error?: string;
}
export function formatEvalReport(
  rows: EvalRow[],
  usage: { input: number; output: number; cacheRead: number },
): string;
```

- [ ] **1.1 Failing tests.** Build a `good` analysis for `fixturePapers[0].paper` + `fixtureProject.context`: overview text taken from words in its abstract, one stance per claim, the rest `"not stated"`. Then:
  - `good` gives `{ failures: [], warnings: [] }`.
  - **Each failure check, one test each,** by mutating one field:
    - a `https://` link, and a `10.1016/x` DOI;
    - "Boer" (an author surname), including "Boer's" and "BOER";
    - "de Looze" gives "Looze";
    - a 6-word run of another fixture paper's title, with punctuation stripped;
    - a 6-word run of its own title;
    - "et al.", "(Smith, 2020)", "(Smith 2020)";
    - a year "1999" not in the source (failure), but the paper's own year passes;
    - a missing claim id, an extra unknown id, and a duplicated id.
  - **No-abstract copy** (`{ ...paper, abstract: undefined }`): an overview other than "not stated" fails; a stance that isn't `unclear` fails; the correct output passes.
  - **Warnings:**
    - "312 teens" with 312 not in the source warns; "2,109" and "2109" with "2,109" in the source don't;
    - "2109 adolescents" isn't treated as a year;
    - `repaired: true` warns;
    - a 35-word overview warns, and a 34-word one with limit 35 also warns (within 1); "not stated" never warns.
  - **No false alarms:** a single title word ("media") and a short surname ("Li") don't fail. A surname that also appears in the abstract as an ordinary word is skipped.
  - **`formatEvalReport`:** includes one line per row with PASS/FAIL, and the totals line `papers 2, passed 1, failures 1, warnings 0, repaired 0, tokens in 10 / out 5 / cache 3`.
  - Run `pnpm vitest run src/lib/ai/eval.test.ts`. Expect FAIL (module missing).
- [ ] **1.2 Implement.**
  - Helpers:
    - `norm(s)`: lowercase, then punctuation → space, collapsed;
    - `runs(text, 6)`: a set of 6-word shingles;
    - `numbers(s)`: digits with commas stripped.
  - Surnames: the last whitespace-separated token of each author name, with possessive `'s` stripped, at least 3 letters. Skip it if it appears in the abstract as a word.
  - Report: a fixed-width line per row, then totals.
- [ ] **1.3** Run the same command. Expect PASS. Then `pnpm vitest run src/lib/ai`. Expect all green.
- [ ] **1.4** Commit `feat(ai): add analysis eval checks`.

### Task 2: live eval

**Files:** create `src/lib/ai/paper-analysis.eval.live.test.ts`

**Consumes:** `checkAnalysis`, `formatEvalReport` and `EvalRow` from `./eval`; `analysePaper` from `./paper-analysis` (dynamic import after `vi.mock("server-only")`, as in `relations.live.test.ts`); `fixturePapers` and `fixtureProject`.

- [ ] **2.1 Write it.**
  - `describe.skipIf(process.env.AI_LIVE !== "1")`.
  - Inputs are `fixturePapers.slice(0, 10)` plus `{ ...first, id: first.id + "-noabstract", abstract: undefined }`.
  - Run them sequentially, to stay gentle on rate limits and keep the log readable.
  - Catch per-paper errors into `row.error`, which counts as a failure.
  - Sum the usage, `console.log(formatEvalReport(...))`, then `expect(failedRows).toEqual([])`.
  - Timeout: 300 000 ms.
- [ ] **2.2** Without the flag, run `pnpm vitest run src/lib/ai/paper-analysis.eval.live.test.ts`. Expect it to be skipped (0 run).
- [ ] **2.3** Live run:
      `AI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/ai/paper-analysis.eval.live.test.ts --silent=false`.
      Expect the report to print.
  - If a **real failure** appears, keep it. Don't loosen a check to make it pass. Record it in the ledger and report it to the user: it's a finding about the prompt, which belongs to AI-03.
  - If it's a **false alarm** from the checker, fix the checker with a new failing test first, and record a ruling.
- [ ] **2.4** Paste the report into the ledger, for the PR body. Commit `test(ai): add live paper analysis eval`.

### Task 3: review + local ship prep

- [ ] **3.1** Run `pnpm check && pnpm build`.
- [ ] **3.2** Run the `pr-reviewer` agent (Opus) with this Review focus. Fix the Blockers and Should-fixes with tests that fail first.
- [ ] **3.3** `git fetch origin dev && git rebase origin/dev`, then `pnpm check` again.
- [ ] **3.4** Draft the PR body (including the eval report) and the push/PR steps for the user. Because the claim was already pushed, the first push after the rebase is `--force-with-lease`. Push the checklist tick **before** merging, and squash-merge.
