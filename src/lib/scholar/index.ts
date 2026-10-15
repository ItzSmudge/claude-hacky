import { serverEnv } from "@/lib/env";
import {
  searchOpenAlex as searchOpenAlexWith,
  type OpenAlexDeps,
  type OpenAlexSearchParams,
} from "./openalex";

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
