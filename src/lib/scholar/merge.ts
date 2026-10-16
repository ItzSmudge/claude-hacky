/**
 * Semantic Scholar enrichment of OpenAlex results (SE-03). Only two S2 fields ever reach a
 * Paper — the TLDR, and the abstract when OpenAlex has none — and both are copied verbatim.
 * Everything else (id, bibliographic data, topics) stays OpenAlex's, so credibility is unchanged.
 */
import type { Paper } from "@/types/domain";

export interface S2Enrichment {
  tldr?: string;
  abstract?: string;
}

/** A usable piece of text: a string that isn't blank once whitespace is collapsed. */
const text = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() || undefined : undefined;

/** New Paper objects with S2's TLDR (and abstract if missing), keyed by lowercase DOI; same order. */
export function enrichPapers(papers: Paper[], byDoi: Map<string, S2Enrichment>): Paper[] {
  return papers.map((paper) => {
    const extra = paper.doi ? byDoi.get(paper.doi.toLowerCase()) : undefined;
    if (!extra) return paper;
    const out = { ...paper };
    const tldr = text(extra.tldr);
    const abstract = text(extra.abstract);
    if (tldr) out.tldr = tldr;
    if (abstract && !text(paper.abstract)) out.abstract = abstract;
    return out;
  });
}

/**
 * Keeps a cached row's TLDR/abstract when the fresh paper has none, so a search during an S2
 * outage doesn't erase them. `cached` is the row's jsonb `data`; anything unexpected is ignored.
 */
export function keepCachedFields(paper: Paper, cached: unknown): Paper {
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return paper;
  const row = cached as Record<string, unknown>;
  const tldr = !text(paper.tldr) ? text(row.tldr) : undefined;
  const abstract = !text(paper.abstract) ? text(row.abstract) : undefined;
  if (!tldr && !abstract) return paper;
  const out = { ...paper };
  if (tldr) out.tldr = tldr;
  if (abstract) out.abstract = abstract;
  return out;
}
