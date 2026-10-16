import type { SupabaseClient } from "@supabase/supabase-js";
import { projectContextSchema, type Project } from "@/lib/api-schemas";
import type { Database, Json } from "@/types/database";

/** A project in the history sidebar: the API shape plus counts (projectListResponseSchema). */
export type ProjectListItem = Project & { savedCount: number; swipeCount: number };

export const PROJECT_COLUMNS = "id, owner_id, title, query, context, join_code, created_at";

interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  query: string;
  context: Json | null;
  join_code: string;
  created_at: string;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    query: row.query,
    context: projectContextSchema.safeParse(row.context).data ?? null,
    joinCode: row.join_code,
    createdAt: row.created_at,
  };
}

/**
 * Per project: papers in the shared library (saved by any member, counted once) and how many
 * swipes the caller has made there.
 */
export function summariseSwipes(
  rows: readonly { project_id: string; paper_id: string; user_id: string; decision: string }[],
  userId: string,
) {
  const saved = new Map<string, Set<string>>();
  const counts = new Map<string, { savedCount: number; swipeCount: number }>();
  for (const r of rows) {
    const c = counts.get(r.project_id) ?? { savedCount: 0, swipeCount: 0 };
    if (r.user_id === userId) c.swipeCount++;
    if (r.decision === "save") {
      const papers = saved.get(r.project_id) ?? new Set<string>();
      papers.add(r.paper_id);
      saved.set(r.project_id, papers);
      c.savedCount = papers.size;
    }
    counts.set(r.project_id, c);
  }
  return counts;
}

/** The caller's projects (RLS: owned or joined), newest first, with counts. Null on a DB error. */
export async function loadProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProjectListItem[] | null> {
  const projects = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: false });
  if (projects.error) {
    console.error("[projects] list failed", projects.error.code, projects.error.message);
    return null;
  }
  if (projects.data.length === 0) return [];

  const swipes = await supabase
    .from("swipes")
    .select("project_id, paper_id, user_id, decision")
    .in(
      "project_id",
      projects.data.map((p) => p.id),
    );
  if (swipes.error) {
    console.error("[projects] counts failed", swipes.error.code, swipes.error.message);
    return null;
  }
  const counts = summariseSwipes(swipes.data, userId);
  return projects.data.map((row) => ({
    ...toProject(row),
    ...(counts.get(row.id) ?? { savedCount: 0, swipeCount: 0 }),
  }));
}
