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
// OpenAlex basic paging stops at 10k results; past that it answers 400.
const MAX_RESULTS = 10_000;
const MAX_RETRY_AFTER_MS = 5_000;
// Markup OpenAlex leaves in titles. A bare "<" (as in "p < 0.05") is kept.
const TITLE_MARKUP = /<\/?(?:i|b|em|strong|sub|sup|scp|span|p|br|mml:[\w-]+)\b[^>]*>/gi;
const PEER_REVIEWED_TYPES = new Set(["article", "review", "conference-paper"]);
// Refereed venues; conference proceedings are the main peer-reviewed outlet in CS.
const PEER_REVIEWED_SOURCES = new Set(["journal", "conference"]);
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
  const placed: [number, string][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const at of positions) if (Number.isInteger(at) && at >= 0) placed.push([at, word]);
  }
  placed.sort((a, b) => a[0] - b[0]);
  return nonEmpty(placed.map(([, word]) => word).join(" "));
}

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

/** OpenAlex work → our Paper, or null when the work shouldn't reach the deck. */
export function workToPaper(work: OpenAlexWork): Paper | null {
  const externalId = work.id?.match(/^https:\/\/openalex\.org\/(W\d+)$/)?.[1];
  const title = nonEmpty((work.display_name ?? work.title)?.replace(TITLE_MARKUP, ""));
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
      ? `https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`
      : (httpUrl(work.primary_location?.landing_page_url) ?? `https://openalex.org/${externalId}`),
    isPeerReviewed:
      PEER_REVIEWED_TYPES.has(work.type ?? "") && PEER_REVIEWED_SOURCES.has(source?.type ?? ""),
    topics: topics.length ? topics : primaryTopic ? [primaryTopic] : [],
  };
  const abstract = abstractFromInvertedIndex(work.abstract_inverted_index);
  const venue = nonEmpty(source?.display_name);
  const pdfUrl = httpUrl(work.best_oa_location?.pdf_url);
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
  /**
   * Worst case without one is ~34 s (3 × 8 s timeout + backoff), so callers serving a person
   * (SE-05) should pass a deadline signal.
   */
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
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
  if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from];
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

/** Resolves after `ms`, or as soon as `signal` aborts (the loop then re-checks it). */
function defaultSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

const aborted = () => new OpenAlexError("OpenAlex request aborted", 0, false);

export async function searchOpenAlex(
  params: OpenAlexSearchParams,
  { fetch = globalThis.fetch, mailto, signal, sleep = defaultSleep }: OpenAlexDeps = {},
): Promise<OpenAlexSearchResult> {
  if (!params.q.trim()) throw new OpenAlexError("Search query is empty", 400, false);
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
    if (signal?.aborted) throw aborted();
    if (attempt > 0) {
      await sleep(retryAfter ?? BACKOFF_MS[attempt - 1]!, signal);
      if (signal?.aborted) throw aborted();
    }

    let res: Response;
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      if (signal?.aborted) throw aborted();
      last = new OpenAlexError("OpenAlex unreachable", 0, true);
      retryAfter = undefined;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      last = new OpenAlexError(`OpenAlex responded ${res.status}`, res.status, true);
      retryAfter = retryAfterMs(res);
      await res.body?.cancel().catch(() => {});
      continue;
    }
    if (!res.ok) throw new OpenAlexError(`OpenAlex responded ${res.status}`, res.status, false);

    let text: string;
    try {
      text = await res.text();
    } catch {
      // The timeout also covers reading the body.
      if (signal?.aborted) throw aborted();
      last = new OpenAlexError("OpenAlex body read failed", 0, true);
      retryAfter = undefined;
      continue;
    }
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new OpenAlexError("OpenAlex returned a malformed body", 502, false);
    const { meta, results } = parsed.data;
    return {
      papers: results
        .map((work) => workToPaper(work as OpenAlexWork))
        .filter((p): p is Paper => !!p),
      total: meta.count,
      nextPage: page * perPage < Math.min(meta.count, MAX_RESULTS) ? page + 1 : null,
    };
  }
  throw last;
}
