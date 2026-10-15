import { NextResponse } from "next/server";
import { z } from "zod";
import { searchRequestSchema, type ApiError, type SearchResponse } from "@/lib/api-schemas";
import { OpenAlexError, searchOpenAlex } from "@/lib/scholar";
import { cachePapers } from "@/lib/scholar/cache";
import { parseExcludeTerms, searchPapers } from "@/lib/scholar/search";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: search (SE-05). GET /api/search?q=…&page=…&perPage=…&yearFrom=…&yearTo=…&exclude=a,b

/** Upper bound on one search, including OpenAlex retries; the deck shows an error after. */
const DEADLINE_MS = 15_000;

const error = (status: number, message: string, details?: unknown, headers?: HeadersInit) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers },
  );

export async function GET(request: Request) {
  // Signed-in users only (anonymous sessions count): every search spends shared OpenAlex budget.
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return error(401, "Sign in to search");

  const params = new URL(request.url).searchParams;
  const parsed = searchRequestSchema.safeParse({
    q: params.get("q") ?? undefined,
    projectId: params.get("projectId") || undefined,
    yearFrom: params.get("yearFrom") || undefined,
    yearTo: params.get("yearTo") || undefined,
    exclude: parseExcludeTerms(params),
    page: params.get("page") || undefined,
    perPage: params.get("perPage") || undefined,
  });
  if (!parsed.success) return error(400, "Invalid search", z.treeifyError(parsed.error));

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
  try {
    const response = await searchPapers(parsed.data, {
      search: (query) => searchOpenAlex(query, { signal }),
      cache: cachePapers,
    });
    return NextResponse.json<SearchResponse>(response);
  } catch (err) {
    if (!(err instanceof OpenAlexError)) {
      console.error("[search] unexpected failure", err);
      return error(500, "Paper search failed");
    }
    if (err.retryable || err.status === 0) {
      return error(503, "Paper search is busy — try again in a moment", undefined, {
        "Retry-After": "5",
      });
    }
    if (err.status === 400) return error(400, "Invalid search");
    console.error("[search] OpenAlex failed", err.status, err.message);
    return error(502, "Paper search failed");
  }
}
