import type { Paper } from "@/types/domain";

/** Pure display helpers for the detail sheet. Data comes from the scholar APIs; we only format it. */

export function formatAuthorList(authors: Paper["authors"], max = 8): string {
  const names = authors.map((a) => a.name.trim()).filter(Boolean);
  if (names.length === 0) return "Authors not stated";
  if (names.length === 1) return names[0];
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

const DOI_PREFIX = /^(?:doi:\s*|https?:\/\/(?:dx\.|www\.)?doi\.org\/)/i;

/** Bare DOI ("10.x/…") from any common spelling, or undefined if it isn't one. */
export function normaliseDoi(doi: string | undefined): string | undefined {
  const bare = doi?.trim().replace(DOI_PREFIX, "").trim();
  return bare && /^10\.\d{4,}\/\S+$/.test(bare) ? bare : undefined;
}

/** Absolute http(s) URL, else undefined (drops javascript:, relative paths, junk). */
function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export interface PaperLink {
  kind: "page" | "doi" | "pdf";
  label: string;
  href: string;
}

/** DOI link with each path segment encoded, so "#", "?" or "%" in old DOIs don't break it. */
const doiLink = (doi: string) =>
  `https://doi.org/${doi.split("/").map(encodeURIComponent).join("/")}`;

/** Landing page, DOI and PDF links — deduplicated, http(s) only. */
export function paperLinks(paper: Paper): PaperLink[] {
  const doi = normaliseDoi(paper.doi);
  const doiHref = doi ? doiLink(doi) : undefined;
  const page = safeUrl(paper.url);
  const pdf = safeUrl(paper.pdfUrl);

  const links: PaperLink[] = [];
  // DOIs are case-insensitive; other URL paths are not.
  const isDoiPage = doi !== undefined && normaliseDoi(page)?.toLowerCase() === doi.toLowerCase();
  if (page && !isDoiPage) {
    links.push({ kind: "page", label: "Open paper", href: page });
  }
  if (doi && doiHref) links.push({ kind: "doi", label: doi, href: doiHref });
  if (pdf && !links.some((l) => l.href === pdf)) {
    links.push({ kind: "pdf", label: "PDF", href: pdf });
  }
  return links;
}

/** Trimmed text, or undefined when missing or the model's "not stated". */
export function orNotStated(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed || /^not stated\.?$/i.test(trimmed)) return undefined;
  return trimmed;
}
