import { z } from "zod";

/**
 * Zod schemas for every LLM output live here (CLAUDE.md). Shared building blocks first; task
 * schemas (brief → ProjectContext, paper analysis, relations) are added by AI-02/03/05.
 * Bibliographic data never appears in these schemas: papers are referenced by internal id only.
 */

/** What the model writes when the source doesn't say. */
export const NOT_STATED = "not stated";

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Non-empty text of at most `max` words. JSON Schema can't express this, so zod enforces it. */
export const words = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty.")
    .superRefine((text, ctx) => {
      const n = countWords(text);
      if (n > max)
        ctx.addIssue({ code: "custom", message: `Use at most ${max} words (got ${n}).` });
    });

/** Like `words`, but tells the model to write "not stated" when the source is silent. */
export const notStated = (max: number) =>
  words(max).describe(
    `At most ${max} words, or exactly "${NOT_STATED}" if the source does not say.`,
  );
