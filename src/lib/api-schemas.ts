/**
 * FROZEN CONTRACTS — request/response shapes for every API route.
 * Route handlers parse requests with these; clients may import the inferred types.
 * Changes need a `chore(contracts): …` PR.
 */
import { z } from "zod";

// ── Shared domain schemas (mirror src/types/domain.ts) ─────────────────
export const paperSourceSchema = z.enum(["openalex", "semanticscholar"]);
export const stanceSchema = z.enum(["supports", "challenges", "neutral", "unclear"]);
export const useAsSchema = z.enum(["evidence", "counterpoint", "background", "method"]);
export const swipeDecisionSchema = z.enum(["save", "skip"]);

export const paperSchema = z.object({
  id: z.string(),
  source: paperSourceSchema,
  externalId: z.string(),
  doi: z.string().optional(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })),
  year: z.number().int().optional(),
  venue: z.string().optional(),
  url: z.string().optional(),
  pdfUrl: z.string().optional(),
  citationCount: z.number().int().nonnegative().optional(),
  isPeerReviewed: z.boolean().optional(),
  topics: z.array(z.string()),
  tldr: z.string().optional(),
});

export const paperAnalysisSchema = z.object({
  paperId: z.string(),
  projectId: z.string(),
  overview: z.string(),
  whyItMatters: z.string(),
  relevance: z.number().min(0).max(100),
  relevanceReason: z.string(),
  stances: z.array(z.object({ claimId: z.string(), stance: stanceSchema, note: z.string() })),
  methodology: z.string(),
  limitations: z.string(),
  useAs: useAsSchema,
});

export const credibilitySchema = z.object({
  score: z.number().min(0).max(100),
  inputs: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

export const projectContextSchema = z.object({
  topic: z.string(),
  claims: z.array(z.object({ id: z.string(), text: z.string() })),
  themes: z.array(z.string()),
  constraints: z.array(z.string()),
  summary: z.string(),
});

export const apiErrorSchema = z.object({ error: z.string(), details: z.unknown().optional() });
export type ApiError = z.infer<typeof apiErrorSchema>;

// ── GET /api/search ────────────────────────────────────────────────────
export const searchRequestSchema = z.object({
  q: z.string().trim().min(1).max(300),
  projectId: z.uuid().optional(),
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  exclude: z.array(z.string()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});
export const searchResponseSchema = z.object({
  papers: z.array(paperSchema.extend({ credibility: credibilitySchema })),
  nextPage: z.number().int().nullable(),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// ── POST /api/analyse (streams NDJSON, one AnalyseStreamEvent per line) ─
export const analyseRequestSchema = z.object({
  projectId: z.uuid(),
  paperIds: z.array(z.string()).min(1).max(10),
});
export const analyseStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("analysis"), analysis: paperAnalysisSchema }),
  z.object({ type: z.literal("error"), paperId: z.string(), error: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type AnalyseRequest = z.infer<typeof analyseRequestSchema>;
export type AnalyseStreamEvent = z.infer<typeof analyseStreamEventSchema>;

// ── /api/projects ──────────────────────────────────────────────────────
export const projectSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  title: z.string(),
  query: z.string(),
  context: projectContextSchema.nullable(),
  joinCode: z.string(),
  createdAt: z.string(),
});
export const createProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  query: z.string().trim().min(1).max(2000),
  // brief upload is multipart (field `brief`); parsed context is returned in the project
});
export const updateProjectRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  query: z.string().trim().min(1).max(2000).optional(),
  context: projectContextSchema.optional(),
});
export const projectListResponseSchema = z.object({
  projects: z.array(
    projectSchema.extend({ savedCount: z.number().int(), swipeCount: z.number().int() }),
  ),
});
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

// ── POST /api/projects/[projectId]/swipes ─────────────────────────────
export const swipeRequestSchema = z.object({
  paperId: z.string(),
  decision: swipeDecisionSchema,
});
export type SwipeRequest = z.infer<typeof swipeRequestSchema>;

// ── GET /api/export/[projectId]?format=… ──────────────────────────────
export const exportFormatSchema = z.enum(["bibtex", "latex", "csv", "markdown"]);
export const exportRequestSchema = z.object({ format: exportFormatSchema });
export type ExportFormat = z.infer<typeof exportFormatSchema>;
