// Server-only entry point for AI tasks (AI-02/03/05, RK-03). Import from "@/lib/ai".
export { askJson, modelFor, type ModelTier } from "./client";
export { AiConfigError, AiOutputError, AiRefusalError, BriefInputError } from "./errors";
export type { JsonRequest, JsonResult, JsonUsage } from "./json";
export { countWords, NOT_STATED, notStated, words } from "./schemas";
export {
  analysePaper,
  buildPaperAnalysisPrompt,
  finalisePaperAnalysis,
  type AnalysePaperInput,
} from "./paper-analysis";
export { paperAnalysisOutputSchema, type PaperAnalysisOutput } from "./schemas";
export {
  buildBriefPrompt,
  finaliseBriefContext,
  parseBrief,
  type ParseBriefInput,
  type ParsedBrief,
} from "./brief";
export { MAX_BRIEF_BYTES, MAX_BRIEF_CHARS, type BriefFile } from "./brief-input";
export { briefContextOutputSchema, normaliseNotStated, type BriefContextOutput } from "./schemas";
export { analyseRelations, type AnalyseRelationsInput } from "./relations";
export {
  outlineOutputSchema,
  projectOutlineSchema,
  type OutlineOutput,
  type ProjectOutline,
} from "./schemas";
export {
  projectRelationsSchema,
  relationsOutputSchema,
  type ProjectRelations,
  type RelationsOutput,
} from "./schemas";
export { phraseInsight, type InsightPrompt } from "./insight";
export { insightOutputSchema, type InsightOutput } from "./schemas";
