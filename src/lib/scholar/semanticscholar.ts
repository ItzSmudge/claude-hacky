/**
 * Semantic Scholar paper search (SE-02) and DOI batch lookup (SE-03). Every bibliographic field
 * is copied from S2; papers we can't cite safely (no id or title) are dropped rather than patched
 * up. S2's one-line TLDR is the reason to call it at all: SE-03 adds it to OpenAlex results.
 */
import { z } from "zod";
import { normaliseDoi } from "@/lib/export/doi";
import type { Paper } from "@/types/domain";
import type { S2Enrichment } from "./merge";
import type { OpenAlexSearchResult } from "./openalex";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const API = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = [
  "paperId",
  "externalIds",
  "title",
  "abstract",
  "year",
  "venue",
  "publicationVenue",
  "publicationTypes",
  "authors",
  "citationCount",
  "openAccessPdf",
  "tldr",
  "url",
  "fieldsOfStudy",
].join(",");
const MAX_PER_PAGE = 100;
// Relevance search only serves offset + limit ≤ 1,000; past that S2 answers 400.
const MAX_RESULTS = 1_000;
const TIMEOUT_MS = 8_000;
const BACKOFF_MS = [500, 1_500];
const MAX_RETRY_AFTER_MS = 5_000;
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

export class SemanticScholarError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SemanticScholarError";
  }
}

export interface SemanticScholarSearchParams {
  q: string;
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  perPage?: number;
}

export interface SemanticScholarDeps {
  fetch?: Fetch;
  /** Sent as `x-api-key`. Without one S2's shared anonymous pool often answers 429. */
  apiKey?: string;
  /** Worst case without one is ~26 s (3 × 8 s timeout + backoff); callers should pass a deadline. */
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const responseSchema = z.object({
  total: z.number().int().nonnegative(),
  // S2 leaves `data` out entirely when nothing matches.
  data: z.array(z.record(z.string(), z.unknown())).optional(),
});

function yearRange(from?: number, to?: number) {
  if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from];
  if (from === undefined && to === undefined) return undefined;
  return `${from ?? ""}-${to ?? ""}`;
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

const aborted = () => new SemanticScholarError("Semantic Scholar request aborted", 0, false);

export async function searchSemanticScholar(
  params: SemanticScholarSearchParams,
  { fetch = globalThis.fetch, apiKey, signal, sleep = defaultSleep }: SemanticScholarDeps = {},
): Promise<OpenAlexSearchResult> {
  // S2 matches nothing for hyphenated terms ("self-esteem"), so search the words instead.
  const query = clean(params.q.replace(/-/g, " "));
  if (!query) throw new SemanticScholarError("Search query is empty", 400, false);
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.trunc(params.perPage ?? 20)));
  const offset = (page - 1) * perPage;
  // Nothing past the window can be fetched; S2 would answer 400. The true total is unknown here.
  if (offset >= MAX_RESULTS) return { papers: [], total: 0, nextPage: null };
  const url = new URL(API);
  url.searchParams.set("query", query);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(Math.min(perPage, MAX_RESULTS - offset)));
  url.searchParams.set("fields", FIELDS);
  const years = yearRange(params.yearFrom, params.yearTo);
  if (years) url.searchParams.set("year", years);
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  let last = new SemanticScholarError("Semantic Scholar request failed", 0, true);
  let retryAfter: number | undefined;
  let droppedTldr = false;
  let skipBackoff = false;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (signal?.aborted) throw aborted();
    if (attempt > 0 && !skipBackoff) {
      await sleep(retryAfter ?? BACKOFF_MS[attempt - 1]!, signal);
      if (signal?.aborted) throw aborted();
    }
    skipBackoff = false;

    let res: Response;
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(url.toString(), {
        headers,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      if (signal?.aborted) throw aborted();
      last = new SemanticScholarError("Semantic Scholar unreachable", 0, true);
      retryAfter = undefined;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      last = new SemanticScholarError(`Semantic Scholar responded ${res.status}`, res.status, true);
      retryAfter = retryAfterMs(res);
      await res.body?.cancel().catch(() => {});
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      // /paper/search accepted `tldr` when checked (2026-10-16), but it is the field most likely
      // to be restricted: rather than lose every search to a 400, ask once more without it.
      // Doesn't count as a retry or wait.
      if (res.status === 400 && !droppedTldr) {
        droppedTldr = true;
        url.searchParams.set("fields", FIELDS.replace(",tldr", ""));
        skipBackoff = true;
        attempt--;
        continue;
      }
      throw new SemanticScholarError(`Semantic Scholar responded ${res.status}`, res.status, false);
    }

    let text: string;
    try {
      text = await res.text();
    } catch {
      // The timeout also covers reading the body.
      if (signal?.aborted) throw aborted();
      last = new SemanticScholarError("Semantic Scholar body read failed", 0, true);
      retryAfter = undefined;
      continue;
    }
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SemanticScholarError("Semantic Scholar returned a malformed body", 502, false);
    }
    const { total, data = [] } = parsed.data;
    return {
      papers: data.map((raw) => s2PaperToPaper(raw as S2Paper)).filter((p): p is Paper => !!p),
      total,
      nextPage: page * perPage < Math.min(total, MAX_RESULTS) ? page + 1 : null,
    };
  }
  throw last;
}

const BATCH_API = "https://api.semanticscholar.org/graph/v1/paper/batch?fields=tldr,abstract";
// SE-03 runs the lookup inside a 3 s budget, so it gets one short retry, not search's two.
const BATCH_BACKOFF_MS = [500];
const BATCH_MAX_RETRY_AFTER_MS = 2_000;

// One entry per requested id, in order; `null` when S2 doesn't know the paper.
const batchSchema = z.array(z.union([z.null(), z.record(z.string(), z.unknown())]));

/**
 * TLDR and abstract for each DOI S2 knows, keyed by lowercase DOI. Results are matched by
 * position, not by any DOI S2 echoes back. Throws `SemanticScholarError`; callers enriching
 * search results treat any failure as "no enrichment".
 */
export async function lookupSemanticScholarByDoi(
  dois: string[],
  { fetch = globalThis.fetch, apiKey, signal, sleep = defaultSleep }: SemanticScholarDeps = {},
): Promise<Map<string, S2Enrichment>> {
  const ids = [
    ...new Set(dois.map((d) => normaliseDoi(d)?.toLowerCase()).filter((d): d is string => !!d)),
  ];
  const found = new Map<string, S2Enrichment>();
  if (!ids.length) return found;
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  const body = JSON.stringify({ ids: ids.map((doi) => `DOI:${doi}`) });

  let last = new SemanticScholarError("Semantic Scholar batch failed", 0, true);
  let retryAfter: number | undefined;
  for (let attempt = 0; attempt <= BATCH_BACKOFF_MS.length; attempt++) {
    if (signal?.aborted) throw aborted();
    if (attempt > 0) {
      await sleep(
        Math.min(retryAfter ?? BATCH_BACKOFF_MS[attempt - 1]!, BATCH_MAX_RETRY_AFTER_MS),
        signal,
      );
      if (signal?.aborted) throw aborted();
    }

    let res: Response;
    let text: string;
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      res = await fetch(BATCH_API, {
        method: "POST",
        headers,
        body,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (res.status === 429 || res.status >= 500) {
        last = new SemanticScholarError(
          `Semantic Scholar responded ${res.status}`,
          res.status,
          true,
        );
        retryAfter = retryAfterMs(res);
        await res.body?.cancel().catch(() => {});
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new SemanticScholarError(
          `Semantic Scholar responded ${res.status}`,
          res.status,
          false,
        );
      }
      text = await res.text();
    } catch (err) {
      if (err instanceof SemanticScholarError) throw err;
      if (signal?.aborted) throw aborted();
      last = new SemanticScholarError("Semantic Scholar unreachable", 0, true);
      retryAfter = undefined;
      continue;
    }

    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    const parsed = batchSchema.safeParse(json);
    if (!parsed.success || parsed.data.length !== ids.length) {
      throw new SemanticScholarError("Semantic Scholar returned a malformed batch", 502, false);
    }
    parsed.data.forEach((entry, i) => {
      if (!entry) return;
      const tldrText = (entry.tldr as { text?: unknown } | null | undefined)?.text;
      const tldr = typeof tldrText === "string" ? nonEmpty(tldrText) : undefined;
      const abstract = typeof entry.abstract === "string" ? nonEmpty(entry.abstract) : undefined;
      const extra: S2Enrichment = {};
      if (tldr) extra.tldr = tldr;
      if (abstract) extra.abstract = abstract;
      found.set(ids[i]!, extra);
    });
    return found;
  }
  throw last;
}
