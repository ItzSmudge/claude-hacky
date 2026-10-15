import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Paper } from "@/types/domain";

/** Postgres rejects an upsert that touches the same row twice, which would drop the whole page. */
const dedupe = (papers: Paper[]) => [...new Map(papers.map((p) => [p.id, p])).values()];

type PaperRow = Database["public"]["Tables"]["papers"]["Insert"];

/**
 * Upserts retrieved papers into the shared `papers` cache (service role: the table has no
 * user write policy). Swipes, analyses and exports reference these rows by `id`.
 */
export async function cachePapers(papers: Paper[]): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdminClient()
    .from("papers")
    .upsert(
      dedupe(papers).map((paper): PaperRow => ({
        id: paper.id,
        source: paper.source,
        external_id: paper.externalId,
        doi: paper.doi ?? null,
        // Paper is plain JSON data; interfaces just lack Json's index signature.
        // TODO(SE-03): merge with the cached row so an OpenAlex-only refresh keeps S2 fields (tldr).
        data: paper as unknown as PaperRow["data"],
        updated_at: now,
      })),
      { onConflict: "id" },
    );
  if (error) throw new Error(`papers upsert failed: ${error.code} ${error.message}`);
}
