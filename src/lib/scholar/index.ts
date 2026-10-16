import "server-only";
import { serverEnv } from "@/lib/env";
import {
  searchOpenAlex as searchOpenAlexWith,
  type OpenAlexDeps,
  type OpenAlexSearchParams,
} from "./openalex";
import {
  searchSemanticScholar as searchSemanticScholarWith,
  type SemanticScholarDeps,
  type SemanticScholarSearchParams,
} from "./semanticscholar";

export {
  SemanticScholarError,
  s2PaperToPaper,
  type S2Paper,
  type SemanticScholarSearchParams,
} from "./semanticscholar";

export {
  OpenAlexError,
  abstractFromInvertedIndex,
  workToPaper,
  type OpenAlexSearchResult,
  type OpenAlexWork,
} from "./openalex";

/** OpenAlex search with `mailto` from env (polite pool) unless the caller passes one. */
export function searchOpenAlex(params: OpenAlexSearchParams, deps: OpenAlexDeps = {}) {
  return searchOpenAlexWith(params, {
    ...deps,
    mailto: deps.mailto ?? serverEnv().OPENALEX_MAILTO,
  });
}

/** Semantic Scholar search with the API key from env (if set) unless the caller passes one. */
export function searchSemanticScholar(
  params: SemanticScholarSearchParams,
  deps: SemanticScholarDeps = {},
) {
  return searchSemanticScholarWith(params, {
    ...deps,
    apiKey: deps.apiKey ?? serverEnv().SEMANTIC_SCHOLAR_API_KEY,
  });
}
