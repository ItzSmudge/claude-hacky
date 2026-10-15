# RK-01 — Feature extraction per paper

**Goal:** turn each paper into a small set of human-readable features that RK-02 can learn weights for from swipes ("you save longitudinal studies, you skip reviews"), and that RK-03 can name in an insight toast or turn into a filter. Pure, deterministic and unit-tested, with no model calls. Features come only from scholar data (`paper`) and the code-computed `credibility.inputs`, never from the LLM analysis.

## API (`src/lib/ranking/features.ts`)

```ts
type FeatureKind = "topic" | "keyword" | "study" | "year" | "venue" | "cited";
interface PaperFeature { id: string; kind: FeatureKind; label: string } // id = `${kind}:${slug}`
extractFeatures(paper: Paper, opts?: { credibility?: Credibility; now?: Date }): PaperFeature[]
```

The result is deduplicated by `id` and ordered by kind as listed. `id` is stable across papers, so it serves as the weight key in RK-02. `label` is short UI copy ("Reviews", "2020–2022", "Highly cited") for RK-03.

## Features

| Kind      | Source                                        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topic`   | `paper.topics`                                | Each topic, trimmed, max 5. id slug = lower-case, non-alphanumerics → `-`.                                                                                                                                                                                                                                                                                                                                                      |
| `keyword` | `paper.title`                                 | Lower-case word tokens ≥ 4 letters, minus a stopword list (English function words + generic research words: study, analysis, effect, impact, role, among, using, based, review, …), crude plural fold (`-ies`→`-y`, trailing `-s` unless `-ss`/`-us`/`-is`), max 8, in title order.                                                                                                                                             |
| `study`   | `paper.title`                                 | Regex families, several allowed: **review** (systematic/scoping/umbrella/narrative/literature review, meta-analysis, "a review"), **longitudinal** (longitudinal, cohort, panel, prospective, follow-up, cross-lagged), **trial** (randomi[sz]ed, controlled trial, RCT, intervention(s)), **cross-sectional** (cross-sectional, survey, questionnaire), **qualitative** (qualitative, interview(s), focus group(s), thematic). |
| `year`    | `paper.year`, `now`                           | Age = now − year: **last 2 years** (≤ 2), **3–5 years**, **6–10 years**, **older than 10 years**. Missing or future-dated year → no feature.                                                                                                                                                                                                                                                                                    |
| `venue`   | `credibility.inputs.venueType`, `paper.venue` | Use `venueType` if it is one of journal/conference/preprint/book. Otherwise guess from the venue name: preprint (arXiv, bioRxiv, medRxiv, SSRN, Research Square, OSF), conference (conference, proceedings, symposium, workshop), book (book, chapter, handbook). Otherwise no feature.                                                                                                                                         |
| `cited`   | `paper.citationCount`                         | **Rarely cited** (< 10), **Cited** (10–99), **Well cited** (100–999), **Highly cited** (≥ 1000). Missing → no feature.                                                                                                                                                                                                                                                                                                          |

## Edge cases

Empty title / topics / authors; all-caps or punctuation-heavy titles; non-ASCII titles (Unicode letters kept: `\p{L}`); duplicate topics differing only in case; year 0 or NaN; citation count negative/NaN (ignored); `now` defaults to the current date but tests always pass it.

## Testing

TDD in `src/lib/ranking/features.test.ts`: each kind's rules and boundaries (age 2/3, 5/6, 10/11; citations 9/10, 99/100, 999/1000), the stopword and plural rules, multiple study types, the precedence of `venueType` over the name, stable ids, deduplication and caps. Plus one fixture snapshot: every `fixturePapers` entry gets at least one non-topic feature, and their study types aren't all the same. Then `pr-reviewer`, `pnpm check && pnpm build`.

## Out of scope

Weights and re-ranking (RK-02), insight text (RK-03), group weights (RK-04), the LLM analysis fields (stance/useAs) as features, and any UI.
