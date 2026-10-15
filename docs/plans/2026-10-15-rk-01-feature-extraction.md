# RK-01 Feature Extraction Implementation Plan

**Goal:** `extractFeatures(paper, { credibility, now })` → stable, labelled features for RK-02/03.

**Architecture:** one pure module `src/lib/ranking/features.ts`, with a small helper per feature kind and a single exported entry point. No React, no I/O, no model.

**Spec:** `docs/specs/2026-10-15-rk-01-feature-extraction.md`

## Constraints

- Owned path only: `src/lib/ranking`. No contract changes (types live in the module), no deps.
- Inputs only from `paper` and `credibility.inputs` (both code-sourced). Never from `analysis`.
- Deterministic: `now` is injectable; tests always pass it.
- Commits `type(ranking): lowercase summary`.

## Tasks

- [ ] **1. Tests first.** `src/lib/ranking/features.test.ts`: one `describe` per kind plus the entry point (dedup, order, caps, stable ids) and a fixture sanity check. Check: `pnpm test ranking` fails (module missing).
- [ ] **2. Implement** `features.ts`: `slug`, `topicFeatures`, `keywordFeatures` (stopwords, plural fold, `\p{L}` tokens), `studyFeatures` (regex table), `yearFeature`, `venueFeature`, `citedFeature`, then `extractFeatures`. Check: `pnpm test ranking` is green.
- [ ] **3. Index.** `src/lib/ranking/index.ts` re-exports, for RK-02. Check: `pnpm typecheck`.
- [ ] **4. Review + verify.** `pr-reviewer`; `pnpm check && pnpm build`; ship with `/ship-pr`.
