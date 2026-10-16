/**
 * Semantic Scholar paper search (SE-02). Every bibliographic field is copied from S2; papers we
 * can't cite safely (no id or title) are dropped rather than patched up. S2's one-line TLDR is
 * the reason to call it at all: SE-03 merges these with OpenAlex results.
 */
import { normaliseDoi } from "@/lib/export/doi";
import type { Paper } from "@/types/domain";

const MAX_TOPICS = 3;
const PEER_REVIEWED_TYPES = new Set(["JournalArticle", "Conference", "Review"]);
// Refereed venues; S2 calls arXiv and other preprint servers "repository" (or leaves it unset).
const PEER_REVIEWED_VENUES = new Set(["journal", "conference"]);

/** The subset of an S2 paper we request. Anything can be null or missing in practice. */
export interface S2Paper {
  paperId?: string | null;
  externalIds?: { DOI?: string | null } | null;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  publicationVenue?: { name?: string | null; type?: string | null } | null;
  publicationTypes?: string[] | null;
  authors?: ({ name?: string | null } | null)[] | null;
  citationCount?: number | null;
  openAccessPdf?: { url?: string | null } | null;
  tldr?: { text?: string | null } | null;
  url?: string | null;
  fieldsOfStudy?: string[] | null;
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const nonEmpty = (text: string | null | undefined) => (text ? clean(text) || undefined : undefined);

/** Only http(s) links reach the UI as hrefs. */
function httpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** S2 paper → our Paper, or null when it shouldn't reach the deck. */
export function s2PaperToPaper(p: S2Paper): Paper | null {
  const externalId = nonEmpty(p.paperId);
  const title = nonEmpty(p.title);
  if (!externalId || !title) return null;

  const doi = p.externalIds?.DOI ? normaliseDoi(p.externalIds.DOI)?.toLowerCase() : undefined;
  const venueType = p.publicationVenue?.type ?? "";
  const url = doi
    ? `https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`
    : httpUrl(p.url);

  const paper: Paper = {
    id: `semanticscholar-${externalId}`,
    source: "semanticscholar",
    externalId,
    title,
    authors: (p.authors ?? [])
      .map((a) => nonEmpty(a?.name))
      .filter((name): name is string => !!name)
      .map((name) => ({ name })),
    isPeerReviewed:
      (p.publicationTypes ?? []).some((t) => PEER_REVIEWED_TYPES.has(t)) &&
      PEER_REVIEWED_VENUES.has(venueType),
    topics: (p.fieldsOfStudy ?? [])
      .map((t) => nonEmpty(t))
      .filter((t): t is string => !!t)
      .slice(0, MAX_TOPICS),
  };
  const abstract = nonEmpty(p.abstract);
  const tldr = nonEmpty(p.tldr?.text);
  const venue = nonEmpty(p.publicationVenue?.name) ?? nonEmpty(p.venue);
  const pdfUrl = httpUrl(p.openAccessPdf?.url);
  if (doi) paper.doi = doi;
  if (abstract) paper.abstract = abstract;
  if (tldr) paper.tldr = tldr;
  if (Number.isInteger(p.year)) paper.year = p.year!;
  if (venue) paper.venue = venue;
  if (url) paper.url = url;
  if (pdfUrl) paper.pdfUrl = pdfUrl;
  if (Number.isInteger(p.citationCount) && p.citationCount! >= 0) {
    paper.citationCount = p.citationCount!;
  }
  return paper;
}
