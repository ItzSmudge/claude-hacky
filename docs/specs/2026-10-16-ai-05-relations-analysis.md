# AI-05 — Relations analysis over the saved set

**Goal.** Given a project's saved papers, tell the student how they fit together: which papers
back or push against each claim in the brief, which share a method, and which pairs read well
together (complement) or against each other (contrast). LB-04 renders it; this task is the
engine + endpoint. Papers are referenced by internal id only (CLAUDE.md hard rule).

**User flow (via LB-04).** Library page → "Show how these connect" → POST
`/api/analyse/relations` → spinner (≈10–30 s on SMART) → claim groups, method clusters, pairs.
Re-run any time; nothing is stored.

## Inputs / outputs

`POST /api/analyse/relations` `{ projectId: uuid }` → `200 { relations: ProjectRelations }`
(401 signed out, 400 bad body, 404 not a member, 502 model failure, 500 db).

```ts
ProjectRelations = {
  projectId: string;
  paperCount: number;                         // saved papers considered
  claims: { claimId; supports: id[]; challenges: id[] }[];  // one per brief claim, brief order
  methods: { label: string /* ≤6 words */; paperIds: id[] /* ≥2 */ }[];          // ≤6
  pairs: { a: id; b: id; kind: "complement" | "contrast"; note: string /* ≤25 words */ }[]; // ≤8
}
```

Schema + type live in `src/lib/ai/schemas.ts` (client-safe, so LB-04 can import the type).

## How

- **Claim groups are computed by code**, not the model: from each saved paper's stored
  `PaperAnalysis.stances` (supports / challenges), so they always agree with the cards.
  Papers with no stored analysis simply don't appear in claim groups.
- **Methods + pairs come from the SMART model** (`askJson`, `effort: "low"`, cached system
  prompt). Each paper is shown as an alias `P1…Pn` with its title, topics and — when available —
  the stored analysis' overview / methodology / useAs, otherwise the first ~120 words of its
  abstract. The model answers in aliases; code maps them back to paper ids and **discards
  unknown aliases**, self-pairs, duplicate pairs (unordered), and method clusters left with
  < 2 papers. Notes are `noLinks` and told to say "the first / the second paper", never titles,
  authors, years or venues; code also drops any label or note that
  echoes a saved paper's title.
- Loading reuses `loadSavedLibrary` (RLS as the user); the prompt topic is the parsed brief's
  `context.topic`, falling back to the project title.

## Edge cases

- 0–1 saved papers → no model call; empty `methods` / `pairs`, claim groups still built.
- > 30 saved papers → send the 30 most relevant (by stored relevance, unknown last).
- No brief claims → `claims: []`.
- Model refuses / invalid after repair → 502 `"Couldn't analyse relations"`.
- Prompt injection in abstracts → paper text wrapped in `<paper>` tags and treated as data,
  as in AI-03.

## Out of scope

Persisting relations (needs a migration PR), the UI (LB-04), streaming, group-mode weighting.

## My calls (no user input)

Endpoint under `src/app/api/analyse/` (AI's owned path) instead of `/api/projects/...`;
response schema in `src/lib/ai/schemas.ts` rather than the frozen `api-schemas.ts` (can be
promoted by a `chore(contracts)` PR later); claim grouping deterministic from stored stances;
no persistence; small hand-written fixture at `src/lib/ai/__fixtures__/relations.json`
(ids from `src/fixtures`) so LB-04 can build without an API key.
