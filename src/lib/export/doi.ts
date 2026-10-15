/**
 * BibTeX from doi.org content negotiation (LB-02). Best effort: any failure returns null and
 * the caller builds the entry from our own metadata instead.
 */

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;

// doi.org hands content negotiation to the registration agency. Redirects anywhere else (a
// registrant's landing page) are not followed: no blind GETs to arbitrary hosts.
const ALLOWED_HOST =
  /^(?:([\w-]+\.)*doi\.org|([\w-]+\.)*crossref\.org|([\w-]+\.)*datacite\.org|data\.medra\.org|data\.jalc\.org)$/i;

/** Bare DOI ("10.x/…") from a DOI, doi: or doi.org URL form; null if it isn't one. */
export function normaliseDoi(input: string): string | null {
  const doi = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!/^10\.\d{1,9}\/\S+$/.test(doi)) return null;
  return doi.split("/").some((part) => part === "." || part === "..") ? null : doi;
}

/** The body as text, or null once it passes `MAX_BYTES` (stops reading; no full download). */
async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchDoiBibtex(
  doi: string,
  {
    fetch,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent,
  }: { fetch: Fetch; signal?: AbortSignal; timeoutMs?: number; userAgent?: string },
): Promise<string | null> {
  const bare = normaliseDoi(doi);
  if (!bare) return null;
  const timeout = AbortSignal.timeout(timeoutMs);
  const init: RequestInit = {
    headers: {
      accept: "application/x-bibtex; charset=utf-8",
      ...(userAgent ? { "user-agent": userAgent } : {}),
    },
    redirect: "manual",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
  if (init.signal?.aborted) return null;
  try {
    let url = `https://doi.org/${bare.split("/").map(encodeURIComponent).join("/")}`;
    let res = await fetch(url, init);
    for (let hops = 0; res.status >= 300 && res.status < 400; hops++) {
      const location = res.headers.get("location");
      if (!location || hops >= MAX_REDIRECTS) return null;
      const next = new URL(location, url);
      if (next.protocol !== "https:" || !ALLOWED_HOST.test(next.hostname)) return null;
      url = next.href;
      res = await fetch(url, init);
    }
    if (!res.ok) return null;
    if (!res.headers.get("content-type")?.includes("bibtex")) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    return (await readCapped(res))?.trim() || null;
  } catch {
    return null;
  }
}
