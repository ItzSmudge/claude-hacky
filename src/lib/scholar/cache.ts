import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Paper } from "@/types/domain";
import { keepCachedFields } from "./merge";

/** Postgres rejects an upsert that touches the same row twice, which would drop the whole page. */
const dedupe = (papers: Paper[]) => [...new Map(papers.map((p) => [p.id, p])).values()];

type PaperRow = Database["public"]["Tables"]["papers"]["Insert"];

/**
 * Upserts retrieved papers into the shared `papers` cache (service role: the table has no
 * user write policy). Swipes, analyses and exports reference these rows by `id`.
 */
export async function cachePapers(papers: Paper[]): Promise<void> {
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();
  const unique = dedupe(papers);
  // A search during an S2 outage must not erase TLDRs/abstracts an earlier search cached (SE-03).
  // Best effort: if the read fails, upsert what we have.
  const { data: cached } = await admin
    .from("papers")
    .select("id, data")
    .in(
      "id",
      unique.map((p) => p.id),
    );
  const cachedById = new Map((cached ?? []).map((row) => [row.id, row.data]));
  const { error } = await admin.from("papers").upsert(
    unique.map((fresh): PaperRow => {
      const paper = keepCachedFields(fresh, cachedById.get(fresh.id));
      return {
        id: paper.id,
        source: paper.source,
        external_id: paper.externalId,
        doi: paper.doi ?? null,
        // Paper is plain JSON data; interfaces just lack Json's index signature.
        data: paper as unknown as PaperRow["data"],
        updated_at: now,
      };
    }),
    { onConflict: "id" },
  );
  if (error) throw new Error(`papers upsert failed: ${error.code} ${error.message}`);
}
