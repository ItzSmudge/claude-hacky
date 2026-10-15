/**
 * FROZEN CONTRACTS — every workstream codes against these.
 * Changing anything here = a `chore(contracts): …` PR, merged fast, announced in team chat.
 */

export type PaperSource = "openalex" | "semanticscholar";

export interface Paper {
  id: string;
  source: PaperSource;
  externalId: string;
  doi?: string;
  title: string;
  abstract?: string;
  authors: { name: string }[];
  year?: number;
  venue?: string;
  url?: string;
  pdfUrl?: string;
  citationCount?: number;
  isPeerReviewed?: boolean;
  topics: string[];
  tldr?: string;
}

export type Stance = "supports" | "challenges" | "neutral" | "unclear";

export interface PaperAnalysis {
  paperId: string;
  projectId: string;
  overview: string;
  whyItMatters: string;
  relevance: number;
  relevanceReason: string;
  stances: { claimId: string; stance: Stance; note: string }[];
  methodology: string;
  limitations: string;
  useAs: "evidence" | "counterpoint" | "background" | "method";
}

export interface Credibility {
  score: number;
  inputs: Record<string, number | string | boolean>;
}

export interface ProjectContext {
  topic: string;
  claims: { id: string; text: string }[];
  themes: string[];
  constraints: string[];
  summary: string;
}

export type SwipeDecision = "save" | "skip";

export interface Swipe {
  projectId: string;
  paperId: string;
  userId: string;
  decision: SwipeDecision;
  at: string;
}
