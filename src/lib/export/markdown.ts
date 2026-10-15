import type { Paper, PaperAnalysis } from "@/types/domain";
import { paperDoi, paperUrl } from "./bibtex";
import { plainText } from "./cite-key";

/**
 * Markdown reading list (LB-03), grouped by how the paper is used. Bibliographic parts come
 * from retrieved metadata; "Why it matters" is Claude's analysis, labelled as such.
 */

const SECTIONS: [PaperAnalysis["useAs"] | undefined, string][] = [
  ["evidence", "Evidence"],
  ["counterpoint", "Counterpoints"],
  ["background", "Background"],
  ["method", "Methods"],
  [undefined, "Not analysed yet"],
];

/**
 * One line of inert text: whitespace collapsed (a line break could start a list, code block or
 * heading) and characters Markdown or common extensions (GFM, Obsidian) format backslash-escaped.
 */
const escapeMd = (text: string) =>
  plainText(text).replace(/[\\`*_[\]#<>|~$!&=]/g, (ch) => `\\${ch}`);

/** Link destinations can't contain spaces or unbalanced parentheses. */
const LINK_ESCAPES: Record<string, string> = { "(": "%28", ")": "%29", " ": "%20" };
const linkSafe = (url: string) => url.replace(/[()\s]/g, (ch) => LINK_ESCAPES[ch] ?? "%20");

const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

function item(paper: Paper, key: string, analysis: PaperAnalysis | undefined): string {
  const authors = paper.authors.map((a) => a.name.trim()).filter(Boolean);
  const doi = paperDoi(paper);
  const url = paperUrl(paper);
  const parts = [
    `**${sentence(escapeMd(paper.title))}**`,
    authors.length || paper.year
      ? [authors.length ? escapeMd(authors.join(", ")) : "", paper.year ? `(${paper.year})` : ""]
          .filter(Boolean)
          .join(" ") + (paper.year ? "." : "")
      : undefined,
    paper.venue ? `*${sentence(escapeMd(paper.venue))}*` : undefined,
    url ? `[${doi ? `doi:${escapeMd(doi)}` : "link"}](${linkSafe(url)})` : undefined,
  ].filter(Boolean);
  return [
    `- ${parts.join(" ")}`,
    `  \`${key}\``,
    ...(analysis ? [`  Why it matters: ${escapeMd(analysis.whyItMatters)}`] : []),
  ].join("\n");
}

export function markdownReadingList(
  title: string,
  papers: readonly Paper[],
  keys: Map<string, string>,
  analyses: Map<string, PaperAnalysis>,
): string {
  const heading = `# Reading list: ${escapeMd(title)}\n`;
  const unique = [...new Map(papers.map((p) => [p.id, p])).values()];
  if (unique.length === 0) return `${heading}\nNothing saved yet.\n`;

  const sections = SECTIONS.flatMap(([useAs, label]) => {
    const inSection = unique
      .filter((p) => analyses.get(p.id)?.useAs === useAs)
      .sort(
        (a, b) =>
          (analyses.get(b.id)?.relevance ?? 0) - (analyses.get(a.id)?.relevance ?? 0) ||
          (keys.get(a.id)! < keys.get(b.id)! ? -1 : 1),
      );
    if (inSection.length === 0) return [];
    return [
      `## ${label}\n\n${inSection.map((p) => item(p, keys.get(p.id)!, analyses.get(p.id))).join("\n")}\n`,
    ];
  });
  return [heading, ...sections].join("\n");
}
