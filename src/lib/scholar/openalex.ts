/**
 * OpenAlex works search (SE-01). Every bibliographic field is copied from OpenAlex; works we
 * can't cite safely (retracted, paratext, no title/id) are dropped rather than patched up.
 */
import { z } from "zod";
import { normaliseDoi } from "@/lib/export/doi";
import type { Paper } from "@/types/domain";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = "https://api.openalex.org/works";
const MAX_PER_PAGE = 50;
const MAX_TOPICS = 3;
const TIMEOUT_MS = 8_000;
const BACKOFF_MS = [500, 1_500];
const MAX_RETRY_AFTER_MS = 5_000;
const PEER_REVIEWED_TYPES = new Set(["article", "review"]);
const SELECT = [
  "id",
  "doi",
  "display_name",
  "publication_year",
  "type",
  "is_retracted",
  "is_paratext",
  "cited_by_count",
  "authorships",
  "primary_location",
  "best_oa_location",
  "primary_topic",
  "topics",
  "abstract_inverted_index",
].join(",");

/** The subset of an OpenAlex work we select. Everything is nullable in practice. */
export interface OpenAlexWork {
  id?: string | null;
  doi?: string | null;
  display_name?: string | null;
  title?: string | null;
  publication_year?: number | null;
  type?: string | null;
  is_retracted?: boolean | null;
  is_paratext?: boolean | null;
  cited_by_count?: number | null;
  authorships?: { author?: { display_name?: string | null } | null }[] | null;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null; type?: string | null } | null;
  } | null;
  best_oa_location?: { pdf_url?: string | null } | null;
  primary_topic?: { display_name?: string | null } | null;
  topics?: { display_name?: string | null }[] | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export class OpenAlexError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OpenAlexError";
  }
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const nonEmpty = (text: string | null | undefined) => (text ? clean(text) || undefined : undefined);

/** OpenAlex ships abstracts as word → positions; rebuild the plain text. */
export function abstractFromInvertedIndex(
  index: Record<string, number[]> | null | undefined,
): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const at of positions) if (Number.isInteger(at) && at >= 0) words[at] = word;
  }
  // Sparse array: join skips holes once filtered.
  return nonEmpty(words.filter((w) => w !== undefined).join(" "));
}

/** OpenAlex work → our Paper, or null when the work shouldn't reach the deck. */
export function workToPaper(work: OpenAlexWork): Paper | null {
  const externalId = work.id?.match(/^https:\/\/openalex\.org\/(W\d+)$/)?.[1];
  const title = nonEmpty((work.display_name ?? work.title)?.replace(/<[^>]*>/g, ""));
  if (!externalId || !title || work.is_retracted || work.is_paratext) return null;

  const doi = work.doi ? normaliseDoi(work.doi)?.toLowerCase() : undefined;
  const source = work.primary_location?.source;
  const topics = (work.topics ?? [])
    .map((t) => nonEmpty(t?.display_name))
    .filter((t): t is string => !!t)
    .slice(0, MAX_TOPICS);
  const primaryTopic = nonEmpty(work.primary_topic?.display_name);

  const paper: Paper = {
    id: `openalex-${externalId}`,
    source: "openalex",
    externalId,
    title,
    authors: (work.authorships ?? [])
      .map((a) => nonEmpty(a?.author?.display_name))
      .filter((name): name is string => !!name)
      .map((name) => ({ name })),
    url: doi
      ? `https://doi.org/${doi}`
      : (nonEmpty(work.primary_location?.landing_page_url) ?? `https://openalex.org/${externalId}`),
    isPeerReviewed: PEER_REVIEWED_TYPES.has(work.type ?? "") && source?.type === "journal",
    topics: topics.length ? topics : primaryTopic ? [primaryTopic] : [],
  };
  const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
  const venue = nonEmpty(source?.display_name);
  const pdfUrl = nonEmpty(work.best_oa_location?.pdf_url);
  if (doi) paper.doi = doi;
  if (abstract) paper.abstract = abstract;
  if (Number.isInteger(work.publication_year)) paper.year = work.publication_year!;
  if (venue) paper.venue = venue;
  if (pdfUrl) paper.pdfUrl = pdfUrl;
  if (Number.isInteger(work.cited_by_count) && work.cited_by_count! >= 0) {
    paper.citationCount = work.cited_by_count!;
  }
  return paper;
}

export interface OpenAlexSearchParams {
  q: string;
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  perPage?: number;
}

export interface OpenAlexDeps {
  fetch?: Fetch;
  /** Joins OpenAlex's polite pool; the scholar barrel fills it from env. */
  mailto?: string;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}

export interface OpenAlexSearchResult {
  papers: Paper[];
  total: number;
  nextPage: number | null;
}

const responseSchema = z.object({
  meta: z.object({ count: z.number().int().nonnegative() }),
  results: z.array(z.record(z.string(), z.unknown())),
});

function yearFilter(from?: number, to?: number) {
  if (from !== undefined && to !== undefined) return `publication_year:${from}-${to}`;
  if (from !== undefined) return `publication_year:>${from - 1}`;
  if (to !== undefined) return `publication_year:<${to + 1}`;
  return undefined;
}

function retryAfterMs(res: Response): number | undefined {
  const seconds = Number(res.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
    : undefined;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function searchOpenAlex(
  params: OpenAlexSearchParams,
  { fetch = globalThis.fetch, mailto, signal, sleep = defaultSleep }: OpenAlexDeps = {},
): Promise<OpenAlexSearchResult> {
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.trunc(params.perPage ?? 20)));
  const url = new URL(API);
  url.searchParams.set("search", params.q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per-page", String(perPage));
  url.searchParams.set("select", SELECT);
  const filter = yearFilter(params.yearFrom, params.yearTo);
  if (filter) url.searchParams.set("filter", filter);
  if (mailto) url.searchParams.set("mailto", mailto);

  let last = new OpenAlexError("OpenAlex request failed", 0, true);
  let retryAfter: number | undefined;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (signal?.aborted) throw new OpenAlexError("OpenAlex request aborted", 0, false);
    if (attempt > 0) await sleep(retryAfter ?? BACKOFF_MS[attempt - 1]!);

    let res: Response;
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      if (signal?.aborted) throw new OpenAlexError("OpenAlex request aborted", 0, false);
      last = new OpenAlexError("OpenAlex unreachable", 0, true);
      retryAfter = undefined;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      last = new OpenAlexError(`OpenAlex responded ${res.status}`, res.status, true);
      retryAfter = retryAfterMs(res);
      continue;
    }
    if (!res.ok) throw new OpenAlexError(`OpenAlex responded ${res.status}`, res.status, false);

    const parsed = responseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new OpenAlexError("OpenAlex returned a malformed body", 200, false);
    const { meta, results } = parsed.data;
    return {
      papers: results
        .map((work) => workToPaper(work as OpenAlexWork))
        .filter((p): p is Paper => !!p),
      total: meta.count,
      nextPage: page * perPage < meta.count ? page + 1 : null,
    };
  }
  throw last;
}
