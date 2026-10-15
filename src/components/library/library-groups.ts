import type { Credibility, Paper, PaperAnalysis, ProjectContext } from "@/types/domain";

/** One saved paper as the library page shows it. Bibliographic data and credibility are code-made. */
export interface LibraryItem {
  paper: Paper;
  analysis?: PaperAnalysis;
  credibility: Credibility;
  citeKey: string;
  /** Saves are per member: you can only remove your own; a teammate's save keeps it here. */
  savedByMe: boolean;
  savedByTeammate: boolean;
}

export type UseGroupKey = PaperAnalysis["useAs"] | "unanalysed";

/** Writing order: what you argue with first, scene-setting last. */
export const USE_GROUP_ORDER: UseGroupKey[] = [
  "evidence",
  "counterpoint",
  "method",
  "background",
  "unanalysed",
];

const byCredibility = (a: LibraryItem, b: LibraryItem) =>
  b.credibility.score - a.credibility.score || a.paper.title.localeCompare(b.paper.title);

/** Non-empty sections in `USE_GROUP_ORDER`, each sorted by credibility (then title). */
export function groupByUse(items: readonly LibraryItem[]) {
  return USE_GROUP_ORDER.flatMap((key) => {
    const inGroup = items
      .filter((i) => (i.analysis?.useAs ?? "unanalysed") === key)
      .sort(byCredibility);
    return inGroup.length ? [{ key, items: inGroup }] : [];
  });
}

/**
 * Per project claim: papers that support or challenge it (credibility order), and how many
 * saved papers are neutral/unclear on it. Unknown claim ids are ignored; first stance wins.
 */
export function groupByClaim(items: readonly LibraryItem[], claims: ProjectContext["claims"]) {
  return claims.map((claim, index) => {
    const supports: LibraryItem[] = [];
    const challenges: LibraryItem[] = [];
    let otherCount = 0;
    for (const item of items) {
      const stance = item.analysis?.stances.find((s) => s.claimId === claim.id)?.stance;
      if (stance === "supports") supports.push(item);
      else if (stance === "challenges") challenges.push(item);
      else if (stance) otherCount++;
    }
    return {
      claim: { id: claim.id, text: claim.text, label: `Claim ${index + 1}` },
      supports: supports.sort(byCredibility),
      challenges: challenges.sort(byCredibility),
      otherCount,
    };
  });
}
