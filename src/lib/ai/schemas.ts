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

// Links and DOIs are rendered by code from scholar APIs, never written by the model (CLAUDE.md).
const LINK = /\bhttps?:\/\/|\bwww\.\S/i;
const DOI = /\b10\.\d{4,9}\/\S/;

/**
 * Non-empty text of at most `max` words, with no links or DOIs. JSON Schema can't express a word
 * count, so zod enforces it and the description tells the model the limit up front (avoiding a
 * repair call).
 */
export const words = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty.")
    .superRefine((text, ctx) => {
      const n = countWords(text);
      if (n > max)
        ctx.addIssue({ code: "custom", message: `Use at most ${max} words (got ${n}).` });
      if (LINK.test(text) || DOI.test(text))
        ctx.addIssue({ code: "custom", message: "Do not include links or DOIs." });
    })
    .describe(`At most ${max} words.`);

/** Like `words`, but tells the model to write "not stated" when the source is silent. */
export const notStated = (max: number) =>
  words(max).describe(
    `At most ${max} words, or exactly "${NOT_STATED}" if the source does not say.`,
  );

/**
 * AI-03: what the FAST model returns for one paper. Code adds paperId/projectId and cleans up
 * stances (see `finalisePaperAnalysis`); nothing bibliographic is generated.
 */
export const paperAnalysisOutputSchema = z.object({
  overview: notStated(35).describe(
    `Plain-language summary of the abstract in at most 35 words, or exactly "${NOT_STATED}" if there is no abstract.`,
  ),
  whyItMatters: notStated(20).describe(
    `One line, at most 20 words: why this paper matters for the student's brief, or "${NOT_STATED}".`,
  ),
  relevance: z.int().min(0).max(100).describe("Relevance to the brief, 0–100, per the rubric."),
  relevanceReason: words(8).describe("At most 8 words: the main reason for the relevance score."),
  stances: z
    .array(
      z.object({
        claimId: z.string().describe("A claim id from the project context, e.g. c1."),
        stance: stanceSchema,
        note: notStated(12).describe(
          `At most 12 words of evidence from the abstract, or exactly "${NOT_STATED}".`,
        ),
      }),
    )
    .describe("Exactly one entry per claim id in the project context."),
  methodology: notStated(15),
  limitations: notStated(15),
  useAs: useAsSchema,
});
export type PaperAnalysisOutput = z.infer<typeof paperAnalysisOutputSchema>;
