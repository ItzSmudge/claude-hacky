// Server-only entry point for AI tasks (AI-02/03/05, RK-03). Import from "@/lib/ai".
export { askJson, modelFor, type ModelTier } from "./client";
export { AiConfigError, AiOutputError, AiRefusalError } from "./errors";
export type { JsonRequest, JsonResult, JsonUsage } from "./json";
export { countWords, NOT_STATED, notStated, words } from "./schemas";
export {
  analysePaper,
  buildPaperAnalysisPrompt,
  finalisePaperAnalysis,
  type AnalysePaperInput,
} from "./paper-analysis";
export { paperAnalysisOutputSchema, type PaperAnalysisOutput } from "./schemas";
