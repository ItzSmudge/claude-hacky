import type { SearchRequest, SearchResponse } from "@/lib/api-schemas";
import { computeCredibility } from "@/lib/credibility";
import type { Paper } from "@/types/domain";
import type { OpenAlexSearchParams, OpenAlexSearchResult } from "./openalex";

/**
 * Search pipeline behind /api/search (SE-05): plan keyword queries → OpenAlex → drop excluded terms → credibility →
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
  /**
   * Best-effort extras for the page (SE-03: S2 TLDRs). Must return the same papers in the same
   * order; anything else, or a rejection, leaves the page unenriched.
   */
  enrich?: (papers: Paper[]) => Promise<Paper[]>;
  /** Upserts papers into the shared cache; swipes reference `papers`, so this must run. */
  cache?: (papers: Paper[]) => Promise<void>;
  /**
   * Short keyword queries for a long question (OpenAlex ranks a sentence by its filler words).
   * Best effort: a rejection or an empty list searches the question as typed.
   */
  plan?: (q: string) => Promise<string[]>;
  now?: Date;
}

/** Questions longer than this many words are planned into keyword queries first. */
export const MAX_PLAIN_QUERY_WORDS = 6;

async function searchQueries(q: string, plan: SearchDeps["plan"]): Promise<string[]> {
  if (!plan || q.split(/\s+/).filter(Boolean).length <= MAX_PLAIN_QUERY_WORDS) return [q];
  try {
    const queries = (await plan(q)).filter((query) => query.trim());
    return queries.length ? queries : [q];
  } catch (error) {
    console.warn(
      "[search] query planning skipped:",
      error instanceof Error ? error.message : error,
    );
    return [q];
  }
}

/** Round-robin across result lists, first occurrence of each id wins. */
function interleave(lists: Paper[][]): Paper[] {
  const seen = new Set<string>();
  const out: Paper[] = [];
  for (let i = 0; lists.some((list) => i < list.length); i++) {
    for (const list of lists) {
      const paper = list[i];
      if (paper && !seen.has(paper.id)) {
        seen.add(paper.id);
        out.push(paper);
      }
    }
  }
  return out;
}

export async function searchPapers(
  request: SearchRequest,
  { search, enrich, cache, plan, now = new Date() }: SearchDeps,
): Promise<SearchResponse> {
  const queries = await searchQueries(request.q, plan);
  // Each query pages in step, so page n of the deck is page n of every query.
  const perPage = Math.ceil(request.perPage / queries.length);
  const settled = await Promise.allSettled(
    queries.map((q) =>
      search({
        q,
        yearFrom: request.yearFrom,
        yearTo: request.yearTo,
        page: request.page,
        perPage,
      }),
    ),
  );
  const pages = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  if (!pages.length) throw (settled[0] as PromiseRejectedResult).reason;
  const papers = interleave(pages.map((p) => p.papers));
  const nextPage =
    pages.length === 1
      ? pages[0]!.nextPage
      : pages.some((p) => p.nextPage !== null)
        ? request.page + 1
        : null;
  const exclude = (request.exclude ?? []).map(wholeWord);
  let kept = papers.filter((paper) => !matchesExcluded(paper, exclude));

  if (enrich && kept.length) {
    try {
      const enriched = await enrich(kept);
      if (enriched.length !== kept.length) throw new Error("enrichment changed the page size");
      // An abstract S2 filled in hasn't been checked against the exclude terms yet.
      kept = enriched.filter((paper) => !matchesExcluded(paper, exclude));
    } catch (error) {
      console.warn(
        "[search] s2 enrichment skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  }

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
