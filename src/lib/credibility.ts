import type { Credibility, Paper } from "@/types/domain";

/**
 * Credibility (SE-04): a deterministic 0–100 score from retrieved metadata only — never the
 * model. `inputs` holds exactly what the score used, so the badge can show its working.
 * Weights: citations 40 (age-adjusted), peer review 30, venue type 15, recency 15.
 */

export type VenueType = "journal" | "conference" | "preprint" | "book";

const CITATION_POINTS = 40;
/** Citations per year that earn the full citation points. */
const FULL_CITATIONS_PER_YEAR = 50;

const PEER_REVIEWED_POINTS = 30;
const UNKNOWN_PEER_REVIEW_POINTS = 10;

const VENUE_POINTS: Record<VenueType | "unknown", number> = {
  journal: 15,
  conference: 12,
  book: 10,
  preprint: 3,
  unknown: 5,
};

/** [max age in years, points], first match wins. */
const RECENCY_BANDS: [number, number][] = [
  [5, 15],
  [10, 10],
  [20, 5],
  [Infinity, 2],
];
const UNKNOWN_RECENCY_POINTS = 5;

// Superset of the ranking venue guess (src/lib/ranking/features.ts), so the two agree.
const PREPRINT_VENUE = /\b(arxiv|biorxiv|medrxiv|psyarxiv|ssrn|research square|osf|preprints?)\b/i;
const CONFERENCE_VENUE = /\b(conference|proceedings|symposium|workshop|annual meeting)\b/i;
// Journals whose names start like proceedings (PNAS, Proc. R. Soc., Proc. IEEE).
const PROCEEDINGS_JOURNAL =
  /\bproceedings of the (national academy|royal society|ieee\b(?! [\w ]*conference))/i;
const BOOK_VENUE = /\b(e?books?|chapter|handbook)\b/i;

/**
 * Venue type from the venue name, else "journal" for peer-reviewed work; undefined if unknown.
 * `Paper` carries no source type, so a conference named without a keyword (e.g. "Neural
 * Information Processing Systems") falls through to "journal".
 */
export function venueTypeOf(paper: Paper): VenueType | undefined {
  const venue = paper.venue ?? "";
  if (PREPRINT_VENUE.test(venue)) return "preprint";
  if (PROCEEDINGS_JOURNAL.test(venue)) return "journal";
  if (CONFERENCE_VENUE.test(venue)) return "conference";
  if (BOOK_VENUE.test(venue)) return "book";
  return paper.isPeerReviewed ? "journal" : undefined;
}

const validCount = (n: number | undefined) =>
  n !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined;

function citationPoints(count: number | undefined, age: number | undefined): number {
  if (count === undefined) return 0;
  const perYear = count / ((age ?? 0) + 1);
  const scaled = Math.log10(1 + perYear) / Math.log10(1 + FULL_CITATIONS_PER_YEAR);
  return CITATION_POINTS * Math.min(1, scaled);
}

function recencyPoints(age: number | undefined): number {
  if (age === undefined) return UNKNOWN_RECENCY_POINTS;
  return RECENCY_BANDS.find(([maxAge]) => age <= maxAge)![1];
}

export function computeCredibility(
  paper: Paper,
  { now = new Date() }: { now?: Date } = {},
): Credibility {
  const citationCount = validCount(paper.citationCount);
  const year = Number.isInteger(paper.year) ? paper.year : undefined;
  // Papers dated in the future (in press) count as brand new.
  const age = year === undefined ? undefined : Math.max(0, now.getUTCFullYear() - year);
  const venueType = venueTypeOf(paper);
  const peerReviewed = paper.isPeerReviewed;

  const total =
    citationPoints(citationCount, age) +
    (peerReviewed === undefined
      ? UNKNOWN_PEER_REVIEW_POINTS
      : peerReviewed
        ? PEER_REVIEWED_POINTS
        : 0) +
    VENUE_POINTS[venueType ?? "unknown"] +
    recencyPoints(age);

  const inputs: Credibility["inputs"] = {};
  if (citationCount !== undefined) inputs.citationCount = citationCount;
  if (peerReviewed !== undefined) inputs.peerReviewed = peerReviewed;
  if (venueType !== undefined) inputs.venueType = venueType;
  if (year !== undefined) inputs.year = year;

  return { score: Math.min(100, Math.max(0, Math.round(total))), inputs };
}
