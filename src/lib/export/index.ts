import type { Paper } from "@/types/domain";
import { buildEntry, rekeyEntry } from "./bibtex";
import { citeKeys } from "./cite-key";
import { fetchDoiBibtex } from "./doi";

export { buildEntry, escapeLatex, latexTitle, rekeyEntry } from "./bibtex";
export { asciiFold, citeKey, citeKeys, familyName } from "./cite-key";
export { fetchDoiBibtex, normaliseDoi } from "./doi";

const MAX_CONCURRENT_FETCHES = 4;

export interface BibtexResult {
  text: string;
  /** Entries taken from doi.org, and entries built by code from our metadata. */
  fromDoi: number;
  built: number;
}

/** Runs `task` over `items` with at most `limit` in flight, keeping result order. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * A `.bib` file for `papers`, ordered by cite key. doi.org's entry is used where it validates
 * (re-keyed to ours); otherwise the entry is built from the paper's retrieved metadata.
 */
export async function bibtexFor(
  papers: readonly Paper[],
  options: { fetch: (url: string, init?: RequestInit) => Promise<Response>; signal?: AbortSignal },
): Promise<BibtexResult> {
  const keys = citeKeys(papers);
  const unique = [...new Map(papers.map((p) => [p.id, p])).values()];
  const sorted = unique.sort((a, b) => (keys.get(a.id)! < keys.get(b.id)! ? -1 : 1));

  const entries = await mapLimited(sorted, MAX_CONCURRENT_FETCHES, async (paper) => {
    const key = keys.get(paper.id)!;
    const fetched = paper.doi ? await fetchDoiBibtex(paper.doi, options) : null;
    const entry = fetched && rekeyEntry(fetched, key);
    return entry ? { entry, fromDoi: true } : { entry: buildEntry(paper, key), fromDoi: false };
  });

  const fromDoi = entries.filter((e) => e.fromDoi).length;
  const header = `% ${entries.length} ${entries.length === 1 ? "reference" : "references"} exported from PaperCut. Cite keys are stable: lastnameYEARword.\n`;
  const body = entries.map((e) => e.entry).join("\n\n");
  return {
    text: body ? `${header}\n${body}\n` : header,
    fromDoi,
    built: entries.length - fromDoi,
  };
}
