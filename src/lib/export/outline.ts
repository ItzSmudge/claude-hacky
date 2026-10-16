import type { ProjectOutline } from "@/lib/ai/schemas";
import { escapeLatex } from "./bibtex";

/**
 * RD-04: a lit-review outline as LaTeX or Markdown. The model's outline names papers by id only;
 * cite keys come from `keys` (the library's `citeKeys`, as in the .bib export), and ids without a
 * key (a paper removed since) are skipped, so every citation resolves against the export.
 */

type Sections = ProjectOutline["sections"];

const keysFor = (paperIds: readonly string[], keys: Map<string, string>) =>
  paperIds.flatMap((id) => keys.get(id) ?? []);

export function outlineLatex(sections: Sections, keys: Map<string, string>): string {
  return sections
    .map(({ heading, points }) => {
      const items = points.map(({ text, paperIds }) => {
        const cited = keysFor(paperIds, keys);
        return `  \\item ${escapeLatex(text)}${cited.length ? ` \\cite{${cited.join(",")}}` : ""}`;
      });
      return `\\section{${escapeLatex(heading)}}\n\\begin{itemize}\n${items.join("\n")}\n\\end{itemize}\n`;
    })
    .join("\n");
}

export function outlineMarkdown(sections: Sections, keys: Map<string, string>): string {
  return sections
    .map(({ heading, points }) => {
      const items = points.map(({ text, paperIds }) => {
        const cited = keysFor(paperIds, keys).map((key) => `@${key}`);
        return `- ${text}${cited.length ? ` [${cited.join("; ")}]` : ""}`;
      });
      return `## ${heading}\n\n${items.join("\n")}\n`;
    })
    .join("\n");
}

/** Library papers the outline doesn't cite, in the order given. */
export function unusedPaperIds(sections: Sections, paperIds: readonly string[]): string[] {
  const used = new Set(sections.flatMap((s) => s.points.flatMap((p) => p.paperIds)));
  return paperIds.filter((id) => !used.has(id));
}
