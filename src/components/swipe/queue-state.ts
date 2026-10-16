export const AHEAD = 3;
/** Auto-paging stops after this many pages in a row with no analysed card: each page spends OpenAlex budget. */
export const MAX_BARREN_PAGES = 2;

/**
 * Which papers to send to /api/analyse next: the top card plus `ahead` behind it,
 * minus anything already analysed, in flight, failed or decided.
 */
export function idsToAnalyse({
  candidates,
  analysed,
  inflight,
  failed,
  decided,
  ahead = AHEAD,
}: {
  candidates: readonly { id: string }[];
  analysed: Readonly<Record<string, unknown>>;
  inflight: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  decided: ReadonlySet<string>;
  ahead?: number;
}): string[] {
  return candidates
    .filter((c) => !decided.has(c.id) && !failed.has(c.id))
    .slice(0, ahead + 1)
    .map((c) => c.id)
    .filter((id) => !(id in analysed) && !inflight.has(id));
}

/** Should the queue fetch another search page on its own? */
export function shouldAutoPage({
  undecided,
  nextPage,
  searchError,
  analyseUnavailable,
  barrenPages,
  ahead = AHEAD,
}: {
  /** Papers still waiting to be swiped. */
  undecided: number;
  nextPage: number | null;
  searchError: boolean;
  analyseUnavailable: boolean;
  /** Pages fetched in a row without a single analysis arriving. */
  barrenPages: number;
  ahead?: number;
}): boolean {
  if (analyseUnavailable || searchError || nextPage === null) return false;
  if (barrenPages >= MAX_BARREN_PAGES) return false;
  return undecided < ahead * 2;
}
