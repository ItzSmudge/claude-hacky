import type { SupabaseClient } from "@supabase/supabase-js";
import { paperAnalysisSchema, paperSchema } from "@/lib/api-schemas";
import type { Database } from "@/types/database";
import type { Paper } from "@/types/domain";
import type { Vote } from "./group-list";

export interface GroupData {
  title: string;
  /** In join order (owner first). */
  members: { userId: string; displayName: string | null; role: "owner" | "member" }[];
  votes: Vote[];
  /** Papers that at least one member saved. */
  papers: Map<string, Paper>;
  /** Paper id → the analysis's one-line "why it matters", where there is one. */
  whyItMatters: Map<string, string>;
}

export type GroupResult =
  { ok: true; group: GroupData } | { ok: false; reason: "not-found" | "error" };

/**
 * Everything the group page needs, read as the signed-in user: RLS limits it to members
 * ("not-found" otherwise). Malformed papers are skipped.
 */
export async function loadGroup(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<GroupResult> {
  const [project, members, saved] = await Promise.all([
    supabase.from("projects").select("title").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_members")
      .select("user_id, joined_at, role")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true }),
    // One row per paper someone saved, so the 1000-row API cap counts papers, not swipes.
    supabase
      .from("reading_list")
      .select("paper_id")
      .eq("project_id", projectId)
      .order("save_count", { ascending: false })
      .limit(ROW_CAP),
  ]);
  if (project.error) return failed("reading project", project.error);
  if (!project.data) return { ok: false, reason: "not-found" };
  if (members.error) return failed("reading members", members.error);
  if (saved.error) return failed("reading saved papers", saved.error);
  const savedIds = saved.data.flatMap((row) => (row.paper_id ? [row.paper_id] : []));
  if (savedIds.length === ROW_CAP) console.warn("[group] reading list truncated at", ROW_CAP);
  const userIds = members.data.map((m) => m.user_id);

  // Batched by paper id: keeps each request's URL short and its rows (papers × members) under the cap.
  const batches = chunk(savedIds, BATCH);
  const [profiles, swipes, papers, analyses] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    collect(batches, (ids) =>
      supabase
        .from("swipes")
        .select("paper_id, user_id, decision")
        .eq("project_id", projectId)
        .in("paper_id", ids)
        .order("created_at", { ascending: true }),
    ),
    collect(batches, (ids) => supabase.from("papers").select("id, data").in("id", ids)),
    collect(batches, (ids) =>
      supabase
        .from("paper_analyses")
        .select("paper_id, analysis")
        .eq("project_id", projectId)
        .in("paper_id", ids),
    ),
  ]);
  if (swipes.error) return failed("reading swipes", swipes.error);
  if (papers.error) return failed("reading papers", papers.error);
  // Names and summaries are extras: fall back to "Member N" / no line rather than failing.
  if (profiles.error) console.error("[group] reading profiles failed", profiles.error.message);
  if (analyses.error) console.error("[group] reading analyses failed", analyses.error.message);

  const votes: Vote[] = swipes.data.flatMap((row) =>
    row.decision === "save" || row.decision === "skip"
      ? [{ paperId: row.paper_id, userId: row.user_id, decision: row.decision }]
      : [],
  );
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
  const paperMap = new Map<string, Paper>();
  for (const row of papers.data) {
    const parsed = paperSchema.safeParse(row.data);
    if (parsed.success) paperMap.set(row.id, { ...parsed.data, id: row.id });
    else console.warn("[group] skipping malformed paper", row.id);
  }
  const whyItMatters = new Map<string, string>();
  for (const row of analyses.data ?? []) {
    const why = paperAnalysisSchema.safeParse(row.analysis).data?.whyItMatters.trim();
    if (why) whyItMatters.set(row.paper_id, why);
  }
  return {
    ok: true,
    group: {
      title: project.data.title,
      members: members.data.map((m) => ({
        userId: m.user_id,
        displayName: names.get(m.user_id) ?? null,
        role: m.role === "owner" ? "owner" : "member",
      })),
      // Votes on papers we can't show would be counted but never rendered: drop them.
      votes: votes.filter((x) => paperMap.has(x.paperId)),
      papers: paperMap,
      whyItMatters,
    },
  };
}

const ROW_CAP = 1000; // PostgREST max_rows (supabase/config.toml)
const BATCH = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs one query per batch and concatenates the rows; the first error wins. */
async function collect<Row>(
  batches: string[][],
  query: (
    ids: string[],
  ) => PromiseLike<{ data: Row[] | null; error: { code?: string; message: string } | null }>,
): Promise<{ data: Row[]; error: { code?: string; message: string } | null }> {
  const results = await Promise.all(batches.map(query));
  const error = results.find((r) => r.error)?.error ?? null;
  return { data: results.flatMap((r) => r.data ?? []), error };
}

function failed(op: string, err: { code?: string; message: string }): GroupResult {
  console.error(`[group] ${op} failed`, err.code, err.message);
  return { ok: false, reason: "error" };
}
