export const AHEAD = 3;

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
