import type { SearchRequest, SearchResponse } from "@/lib/api-schemas";
import { computeCredibility } from "@/lib/credibility";
import type { Paper } from "@/types/domain";
import type { OpenAlexSearchParams, OpenAlexSearchResult } from "./openalex";

/**
 * Search pipeline behind /api/search (SE-05): OpenAlex → drop excluded terms → credibility →
 * cache in `papers`. Dependencies are injected so this stays testable without network or DB.
 */

const MAX_EXCLUDE_TERMS = 20;
const MAX_TERM_LENGTH = 80;

/** `exclude` from repeated and/or comma-separated query params; lowercased, deduped, capped. */
export function parseExcludeTerms(params: URLSearchParams): string[] | undefined {
  const terms = params
    .getAll("exclude")
    .flatMap((value) => value.split(","))
    .map((term) => term.trim().toLowerCase().slice(0, MAX_TERM_LENGTH))
    .filter(Boolean);
  const unique = [...new Set(terms)].slice(0, MAX_EXCLUDE_TERMS);
  return unique.length ? unique : undefined;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Lookarounds instead of \b so terms ending in symbols ("c++") still match whole words.
const wholeWord = (term: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "iu");

/** True if any term appears as a whole word in the title, abstract or topics (case-insensitive). */
export function matchesExcluded(paper: Paper, terms: string[] | RegExp[]): boolean {
  if (!terms.length) return false;
  const patterns = terms.map((t) => (typeof t === "string" ? wholeWord(t) : t));
  const text = [paper.title, paper.abstract ?? "", ...paper.topics].join(" \n ");
  return patterns.some((pattern) => pattern.test(text));
}

export interface SearchDeps {
  search: (params: OpenAlexSearchParams) => Promise<OpenAlexSearchResult>;
  /** Upserts papers into the shared cache; swipes reference `papers`, so this must run. */
  cache?: (papers: Paper[]) => Promise<void>;
  now?: Date;
}

export async function searchPapers(
  request: SearchRequest,
  { search, cache, now = new Date() }: SearchDeps,
): Promise<SearchResponse> {
  const { papers, nextPage } = await search({
    q: request.q,
    yearFrom: request.yearFrom,
    yearTo: request.yearTo,
    page: request.page,
    perPage: request.perPage,
  });
  const exclude = (request.exclude ?? []).map(wholeWord);
  const kept = papers.filter((paper) => !matchesExcluded(paper, exclude));

  if (cache && kept.length) {
    try {
      await cache(kept);
    } catch (error) {
      // Results are still useful; saving a swipe on an uncached paper fails with 404 instead.
      console.error("[search] caching papers failed", error);
    }
  }

  return {
    papers: kept.map((paper) => ({ ...paper, credibility: computeCredibility(paper, { now }) })),
    nextPage,
  };
}
