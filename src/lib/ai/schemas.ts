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
export const words = (max: number, { noLinks = false }: { noLinks?: boolean } = {}) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty.")
    .superRefine((text, ctx) => {
      const n = countWords(text);
      if (n > max)
        ctx.addIssue({ code: "custom", message: `Use at most ${max} words (got ${n}).` });
      if (noLinks && (LINK.test(text) || DOI.test(text)))
        ctx.addIssue({ code: "custom", message: "Do not include links or DOIs." });
    })
    .describe(`At most ${max} words.`);

/** Like `words`, but tells the model to write "not stated" when the source is silent. */
export const notStated = (max: number, options?: { noLinks?: boolean }) =>
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
const card = { noLinks: true };
export const paperAnalysisOutputSchema = z.object({
  overview: notStated(35, card).describe(
    `Plain-language summary of the abstract in at most 35 words, or exactly "${NOT_STATED}" if there is no abstract.`,
  ),
  whyItMatters: notStated(20, card).describe(
    `One line, at most 20 words: why this paper matters for the student's brief, or "${NOT_STATED}".`,
  ),
  relevance: z.int().min(0).max(100).describe("Relevance to the brief, 0–100, per the rubric."),
  relevanceReason: words(8, card).describe(
    "At most 8 words: the main reason for the relevance score.",
  ),
  stances: z
    .array(
      z.object({
        claimId: z.string().describe("A claim id from the project context, e.g. c1."),
        stance: stanceSchema,
        note: notStated(12, card).describe(
          `At most 12 words of evidence from the abstract, or exactly "${NOT_STATED}".`,
        ),
      }),
    )
    .describe("Exactly one entry per claim id in the project context."),
  methodology: notStated(15, card),
  limitations: notStated(15, card),
  useAs: useAsSchema,
});
export type PaperAnalysisOutput = z.infer<typeof paperAnalysisOutputSchema>;

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
