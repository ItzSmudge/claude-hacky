/**
 * BibTeX from doi.org content negotiation (LB-02). Best effort: any failure returns null and
 * the caller builds the entry from our own metadata instead.
 */

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_BYTES = 64 * 1024;

/** Bare DOI ("10.x/…") from a DOI, doi: or doi.org URL form; null if it isn't one. */
export function normaliseDoi(input: string): string | null {
  const doi = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  return /^10\.\d{1,9}\/\S+$/.test(doi) ? doi : null;
}

export async function fetchDoiBibtex(
  doi: string,
  {
    fetch,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: { fetch: Fetch; signal?: AbortSignal; timeoutMs?: number },
): Promise<string | null> {
  const bare = normaliseDoi(doi);
  if (!bare) return null;
  const path = bare.split("/").map(encodeURIComponent).join("/");
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(`https://doi.org/${path}`, {
      headers: { accept: "application/x-bibtex; charset=utf-8" },
      redirect: "follow",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) return null;
    if (res.headers.get("content-type")?.includes("html")) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const text = await res.text();
    return text.length > MAX_BYTES ? null : text.trim() || null;
  } catch {
    return null;
  }
}
