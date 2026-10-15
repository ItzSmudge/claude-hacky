import type { SupabaseClient } from "@supabase/supabase-js";
import { paperAnalysisSchema, paperSchema } from "@/lib/api-schemas";
import type { Database } from "@/types/database";
import type { Paper, PaperAnalysis } from "@/types/domain";

/** A project's saved library: what every export and the library page render from. */
export interface SavedLibrary {
  title: string;
  papers: Paper[];
  analyses: Map<string, PaperAnalysis>;
}

export type LoadResult =
  { ok: true; library: SavedLibrary } | { ok: false; reason: "not-found" | "error" };

/**
 * Reads as the signed-in user, so RLS limits it to projects they're a member of ("not-found"
 * otherwise). Papers saved by any member count once; malformed rows are skipped.
 */
export async function loadSavedLibrary(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<LoadResult> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) return failed("reading project", projectError);
  if (!project) return { ok: false, reason: "not-found" };

  const [saves, analyses] = await Promise.all([
    supabase
      .from("swipes")
      .select("paper_id, papers(data)")
      .eq("project_id", projectId)
      .eq("decision", "save"),
    supabase.from("paper_analyses").select("paper_id, analysis").eq("project_id", projectId),
  ]);
  if (saves.error) return failed("reading saves", saves.error);
  if (analyses.error) return failed("reading analyses", analyses.error);

  const papers = new Map<string, Paper>();
  for (const row of saves.data) {
    const parsed = paperSchema.safeParse(row.papers?.data);
    if (parsed.success) papers.set(row.paper_id, { ...parsed.data, id: row.paper_id });
    else console.warn("[export] skipping malformed paper", row.paper_id);
  }
  const byPaper = new Map<string, PaperAnalysis>();
  for (const row of analyses.data) {
    if (!papers.has(row.paper_id)) continue;
    const parsed = paperAnalysisSchema.safeParse(row.analysis);
    if (parsed.success) byPaper.set(row.paper_id, { ...parsed.data, paperId: row.paper_id });
  }
  return {
    ok: true,
    library: { title: project.title, papers: [...papers.values()], analyses: byPaper },
  };
}

function failed(op: string, err: { code?: string; message: string }): LoadResult {
  console.error(`[export] ${op} failed`, err.code, err.message);
  return { ok: false, reason: "error" };
}
