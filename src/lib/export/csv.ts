import type { Paper, PaperAnalysis } from "@/types/domain";
import { paperDoi, paperUrl } from "./bibtex";
import { sortByKey, stripTags } from "./cite-key";

/**
 * CSV export (LB-03): RFC 4180 with a UTF-8 BOM so Excel reads accents correctly. Analysis
 * columns are Claude's commentary; every bibliographic column comes from retrieved metadata.
 */

const COLUMNS = [
  "cite_key",
  "title",
  "authors",
  "year",
  "venue",
  "doi",
  "url",
  "citations",
  "peer_reviewed",
  "use_as",
  "relevance",
  "why_it_matters",
  "overview",
] as const;

/** Spreadsheets run cells starting with these as formulas; a leading ' makes them text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | undefined): string {
  if (value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvExport(
  papers: readonly Paper[],
  keys: Map<string, string>,
  analyses: Map<string, PaperAnalysis>,
): string {
  const rows = sortByKey(papers, keys).map((paper) => {
    const analysis = analyses.get(paper.id);
    const authors = paper.authors.map((a) => a.name.trim()).filter(Boolean);
    const peerReviewed = paper.isPeerReviewed === undefined ? undefined : paper.isPeerReviewed;
    const values: Record<(typeof COLUMNS)[number], string | number | undefined> = {
      cite_key: keys.get(paper.id),
      title: stripTags(paper.title).trim(),
      authors: authors.length ? authors.join("; ") : undefined,
      year: paper.year,
      venue: paper.venue,
      doi: paperDoi(paper),
      url: paper.url ?? paperUrl(paper),
      citations: paper.citationCount,
      peer_reviewed: peerReviewed === undefined ? undefined : peerReviewed ? "yes" : "no",
      use_as: analysis?.useAs,
      relevance: analysis?.relevance,
      why_it_matters: analysis?.whyItMatters,
      overview: analysis?.overview,
    };
    return COLUMNS.map((c) => cell(values[c])).join(",");
  });
  return `﻿${[COLUMNS.join(","), ...rows].join("\r\n")}\r\n`;
}
