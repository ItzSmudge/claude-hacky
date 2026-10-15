import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Paper } from "@/types/domain";

/**
 * Upserts retrieved papers into the shared `papers` cache (service role: the table has no
 * user write policy). Swipes, analyses and exports reference these rows by `id`.
 */
type PaperRow = Database["public"]["Tables"]["papers"]["Insert"];

export async function cachePapers(papers: Paper[]): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdminClient()
    .from("papers")
    .upsert(
      papers.map((paper): PaperRow => ({
        id: paper.id,
        source: paper.source,
        external_id: paper.externalId,
        doi: paper.doi ?? null,
        // Paper is plain JSON data; interfaces just lack Json's index signature.
        data: paper as unknown as PaperRow["data"],
        updated_at: now,
      })),
      { onConflict: "id" },
    );
  if (error) throw new Error(`papers upsert failed: ${error.code} ${error.message}`);
}
