import type { Paper } from "@/types/domain";
import { escapeLatex, paperUrl } from "./bibtex";
import { plainText, sortByKey } from "./cite-key";

/** LaTeX `thebibliography` block and `\cite{}` commands (LB-03), rendered by code only. */

const MAX_AUTHORS = 6;

function authorList(paper: Paper): string | undefined {
  const names = paper.authors.map((a) => escapeLatex(plainText(a.name))).filter(Boolean);
  if (names.length === 0) return undefined;
  if (names.length > MAX_AUTHORS) return `${names[0]} et~al.`;
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

/** Adds a full stop unless the text already ends with one (or ? / !). */
const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

function bibitem(paper: Paper, key: string): string {
  const authors = authorList(paper);
  const source = [
    paper.venue ? `\\emph{${escapeLatex(plainText(paper.venue))}}` : undefined,
    paper.year?.toString(),
  ]
    .filter(Boolean)
    .join(", ");
  const url = paperUrl(paper);
  return [
    `\\bibitem{${key}}`,
    ...(authors ? [sentence(authors)] : []),
    `${authors ? "\\newblock " : ""}${sentence(escapeLatex(plainText(paper.title)))}`,
    ...(source ? [`\\newblock ${source}.`] : []),
    ...(url ? [`\\newblock \\url{${url}}.`] : []),
  ].join("\n");
}

export function latexBibliography(papers: readonly Paper[], keys: Map<string, string>): string {
  if (papers.length === 0) return "% Nothing saved yet.\n";
  const sorted = sortByKey(papers, keys);
  const n = sorted.length;
  return [
    `% ${n} ${n === 1 ? "reference" : "references"} exported from PaperCut. Needs \\usepackage{url}; non-Latin scripts need XeLaTeX or LuaLaTeX.`,
    // The argument is the widest label: as many digits as the item count has.
    `\\begin{thebibliography}{${"9".repeat(String(n).length)}}`,
    "",
    ...sorted.map((p) => `${bibitem(p, keys.get(p.id)!)}\n`),
    "\\end{thebibliography}",
    "",
  ].join("\n");
}
