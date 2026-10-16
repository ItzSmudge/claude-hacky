import { z } from "zod";
import { stanceSchema, useAsSchema } from "@/lib/api-schemas";

/**
 * Zod schemas for every LLM output live here (CLAUDE.md). Shared building blocks first; task
 * schemas (brief → ProjectContext, paper analysis, relations) are added by AI-02/03/05.
 * Bibliographic data never appears in these schemas: papers are referenced by internal id only.
 */

/** What the model writes when the source doesn't say. */
export const NOT_STATED = "not stated";

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

// Links and DOIs about papers are rendered by code from scholar APIs, never written by the model
// (CLAUDE.md). Opt-in, because other outputs (e.g. a parsed brief) may legitimately quote one.
const LINK = /\bhttps?:\/\/|\bwww\.\S/i;
const DOI = /\b10\.\d{4,9}\/\S/;

/**
 * Non-empty text of at most `max` words (and, with `noLinks`, no URLs or DOIs). JSON Schema can't
 * express a word count, so zod enforces it and the description tells the model the limit up
 * front (avoiding a repair call).
 */
export const words = (
  max: number,
  { noLinks = false, slack = 1 }: { noLinks?: boolean; slack?: number } = {},
) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty.")
    .superRefine((text, ctx) => {
      const n = countWords(text);
      // `slack` > 1: accept a slightly long reply (the model still sees `max`) and let code fit it
      // to the exact limit afterwards, instead of failing the whole response (see fit-words.ts).
      if (n > Math.floor(max * slack))
        ctx.addIssue({ code: "custom", message: `Use at most ${max} words (got ${n}).` });
      if (noLinks && (LINK.test(text) || DOI.test(text)))
        ctx.addIssue({ code: "custom", message: "Do not include links or DOIs." });
    })
    .describe(`At most ${max} words.`);

/** Like `words`, but tells the model to write "not stated" when the source is silent. */
export const notStated = (max: number, options?: { noLinks?: boolean; slack?: number }) =>
  words(max, options).describe(
    `At most ${max} words, or exactly "${NOT_STATED}" if the source does not say.`,
  );

// "Not stated.", "N/A", "None stated" → the exact marker, so the UI can detect missing info.
const MISSING = /^(not stated|none stated|n\/a|unknown)\.?$/i;
export const normaliseNotStated = (text: string) => (MISSING.test(text.trim()) ? NOT_STATED : text);

/**
 * AI-03: what the FAST model returns for one paper. Code adds paperId/projectId and cleans up
 * stances (see `finalisePaperAnalysis`); nothing bibliographic is generated.
 */
/** The exact word limits on card text; one source for the reply schema, the fitter and the eval. */
export const PAPER_CARD_LIMITS = {
  overview: 35,
  whyItMatters: 20,
  relevanceReason: 8,
  methodology: 15,
  limitations: 15,
  note: 12,
} as const;
const L = PAPER_CARD_LIMITS;
// Card text gets slack: paper-analysis.ts fits it to the exact limit in whole sentences.
const card = { noLinks: true, slack: 1.5 };
export const paperAnalysisOutputSchema = z.object({
  overview: notStated(L.overview, card).describe(
    `Plain-language summary of the abstract in at most ${L.overview} words, or exactly "${NOT_STATED}" if there is no abstract.`,
  ),
  whyItMatters: notStated(L.whyItMatters, card).describe(
    `One line, at most ${L.whyItMatters} words: why this paper matters for the student's brief, or "${NOT_STATED}".`,
  ),
  relevance: z.int().min(0).max(100).describe("Relevance to the brief, 0–100, per the rubric."),
  relevanceReason: words(L.relevanceReason, card).describe(
    `At most ${L.relevanceReason} words: the main reason for the relevance score.`,
  ),
  stances: z
    .array(
      z.object({
        claimId: z.string().describe("A claim id from the project context, e.g. c1."),
        stance: stanceSchema,
        note: notStated(L.note, card).describe(
          `At most ${L.note} words of evidence from the abstract, or exactly "${NOT_STATED}".`,
        ),
      }),
    )
    .describe("Exactly one entry per claim id in the project context."),
  methodology: notStated(L.methodology, card),
  limitations: notStated(L.limitations, card),
  useAs: useAsSchema,
});
export type PaperAnalysisOutput = z.infer<typeof paperAnalysisOutputSchema>;

/**
 * AI-03 word-limit fix: the reply to "make this field concise". Strict (no slack); the model may
 * say "not stated" rather than guess. paper-analysis.ts also rejects any new number, year or name.
 */
export const shortenedFieldOutputSchema = (max: number) =>
  z.object({ text: notStated(max, { noLinks: true }) });

/**
 * AI-02: what the SMART model returns for a brief. Code assigns claim ids c1…cn, dedupes and
 * normalises "not stated" (see `finaliseBriefContext`). No field may hold a link or DOI.
 */
const brief = { noLinks: true };
export const briefContextOutputSchema = z.object({
  topic: words(12, brief).describe("The project's subject in at most 12 words."),
  summary: notStated(60, brief).describe(
    `What the student must produce and argue, in at most 60 words, or exactly "${NOT_STATED}" if neither the question nor the brief says.`,
  ),
  claims: z
    .array(words(25, brief).describe("One testable claim, at most 25 words."))
    .max(6)
    .describe("Up to 6 claims the student will argue or test; empty if none."),
  themes: z
    .array(words(6, brief).describe("A short theme, at most 6 words."))
    .max(8)
    .describe("Up to 8 themes a relevant paper might cover."),
  constraints: z
    .array(words(20, brief).describe("One requirement, at most 20 words."))
    .max(6)
    .describe("Up to 6 requirements on sources or scope stated in the brief; empty if none."),
});
export type BriefContextOutput = z.infer<typeof briefContextOutputSchema>;

/**
 * AI-05: what the SMART model returns about a saved set. Papers appear only as the aliases P1…Pn
 * given in the prompt; code maps them back to ids and drops anything unknown (see
 * `finaliseRelations`). Claim groups are not asked for: code builds them from stored stances.
 */
const relation = { noLinks: true };
export const relationsOutputSchema = z.object({
  methods: z
    .array(
      z.object({
        label: words(6, relation).describe("The shared method or design, at most 6 words."),
        papers: z.array(z.string()).describe("Aliases (e.g. P3) of every paper using it."),
      }),
    )
    .max(6)
    .describe("Up to 6 groups of two or more papers that share a method, design or dataset."),
  pairs: z
    .array(
      z.object({
        a: z.string().describe("Alias of the first paper, e.g. P1."),
        b: z.string().describe("Alias of the second paper, e.g. P4."),
        kind: z.enum(["complement", "contrast"]),
        note: words(25, relation).describe(
          'At most 25 words on why they belong together, calling them "the first paper" and "the second paper".',
        ),
      }),
    )
    .max(8)
    .describe("Up to 8 of the most useful pairs to read together."),
});
export type RelationsOutput = z.infer<typeof relationsOutputSchema>;

/** AI-05: POST /api/analyse/relations → `{ relations }`. Client-safe so LB-04 can import it. */
export const projectRelationsSchema = z.object({
  projectId: z.string(),
  /** Saved papers considered. */
  paperCount: z.int().nonnegative(),
  /** One entry per brief claim, in the brief's order, from the cards' stored stances. */
  claims: z.array(
    z.object({
      claimId: z.string(),
      supports: z.array(z.string()),
      challenges: z.array(z.string()),
    }),
  ),
  methods: z.array(z.object({ label: z.string(), paperIds: z.array(z.string()).min(2) })),
  pairs: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      kind: z.enum(["complement", "contrast"]),
      note: z.string(),
    }),
  ),
});
export type ProjectRelations = z.infer<typeof projectRelationsSchema>;

/**
 * RD-04: what the SMART model returns for a lit-review outline. Papers appear only as aliases
 * P1…Pn; code maps them back to ids and renders every cite key (see `finaliseOutline`).
 */
export const outlineOutputSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: words(8, relation).describe("The section heading, at most 8 words."),
        points: z
          .array(
            z.object({
              text: words(30, relation).describe(
                "One sentence of at most 30 words a student could expand into a paragraph.",
              ),
              papers: z
                .array(z.string())
                .describe("Aliases (e.g. P2) of the papers this point draws on."),
            }),
          )
          .max(5),
      }),
    )
    .max(6)
    .describe("Up to 6 sections in reading order."),
});
export type OutlineOutput = z.infer<typeof outlineOutputSchema>;

/** RD-04: POST /api/analyse/outline → `{ outline }`. Client-safe so the library panel can parse it. */
export const projectOutlineSchema = z.object({
  projectId: z.string(),
  /** Saved papers considered. */
  paperCount: z.int().nonnegative(),
  sections: z.array(
    z.object({
      heading: z.string(),
      points: z.array(z.object({ text: z.string(), paperIds: z.array(z.string()).min(1) })),
    }),
  ),
});
export type ProjectOutline = z.infer<typeof projectOutlineSchema>;

/** RK-03: the SMART model's rewording of one ranking insight. Code supplies the pattern. */
export const insightOutputSchema = z.object({
  sentence: words(18, { noLinks: true }).describe(
    "One friendly sentence of at most 18 words that names the pattern and ends with a short question offering the action.",
  ),
});
export type InsightOutput = z.infer<typeof insightOutputSchema>;
