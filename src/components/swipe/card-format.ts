import type { Paper, PaperAnalysis, ProjectContext } from "@/types/domain";

/** Pure display helpers for the paper card. Data comes from the scholar APIs; we only format it. */

const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? "";

export function formatAuthors(authors: Paper["authors"]): string | undefined {
  const names = authors.map((a) => surname(a.name)).filter(Boolean);
  if (names.length === 0) return undefined;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} et al.`;
}

export function formatMeta(paper: Paper) {
  return {
    venue: paper.venue?.trim() || "Venue not stated",
    year: paper.year ? String(paper.year) : "Year not stated",
    author: formatAuthors(paper.authors) ?? "Authors not stated",
  };
}

export type ResolvedStance = PaperAnalysis["stances"][number] & {
  /** "Claim 2" — position in the project's claim list. */
  label: string;
  claimText: string;
};

/** Attach claim labels/text; stances pointing at unknown claim ids are discarded. */
export function resolveStances(
  stances: PaperAnalysis["stances"],
  claims: ProjectContext["claims"],
): ResolvedStance[] {
  return stances.flatMap((s) => {
    const i = claims.findIndex((c) => c.id === s.claimId);
    if (i === -1) return [];
    return [{ ...s, label: `Claim ${i + 1}`, claimText: claims[i].text }];
  });
}

export function clampRelevance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
