import type { Credibility, Paper, PaperAnalysis, ProjectContext } from "@/types/domain";
import raw from "./papers.json";

export interface FixtureEntry {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
}

export interface FixtureProject {
  id: string;
  title: string;
  query: string;
  context: ProjectContext;
}

/** Demo project matching supabase/seed.sql — build UI against this before the APIs exist. */
export const fixtureProject = raw.project as FixtureProject;
export const fixturePapers = raw.papers as FixtureEntry[];
