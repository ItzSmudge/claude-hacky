// GR-03: the group's compiled reading list, from every member's swipes.
import type { SwipeDecision } from "@/types/domain";

export interface Vote {
  paperId: string;
  userId: string;
  decision: SwipeDecision;
}

export interface GroupPaper {
  paperId: string;
  saves: number;
  skips: number;
  /** Savers first, then skippers, each in vote order. */
  voters: { userId: string; decision: SwipeDecision }[];
  myVote: SwipeDecision | undefined;
}

/**
 * Papers at least one member saved. `discuss`: someone saved it and someone skipped it.
 * `picks`: everyone who voted saved it. Both sorted by saves (most first), then paper id.
 */
export function summariseGroup(
  votes: readonly Vote[],
  me: string | undefined,
): { discuss: GroupPaper[]; picks: GroupPaper[] } {
  const byPaper = new Map<string, Vote[]>();
  for (const vote of votes) byPaper.set(vote.paperId, [...(byPaper.get(vote.paperId) ?? []), vote]);

  const papers: GroupPaper[] = [];
  for (const [paperId, list] of byPaper) {
    const savers = list.filter((x) => x.decision === "save");
    if (savers.length === 0) continue;
    const skippers = list.filter((x) => x.decision === "skip");
    papers.push({
      paperId,
      saves: savers.length,
      skips: skippers.length,
      voters: [...savers, ...skippers].map(({ userId, decision }) => ({ userId, decision })),
      myVote: list.find((x) => x.userId === me)?.decision,
    });
  }
  papers.sort((a, b) => b.saves - a.saves || a.paperId.localeCompare(b.paperId));
  return {
    discuss: papers.filter((p) => p.skips > 0),
    picks: papers.filter((p) => p.skips === 0),
  };
}

/** `votes` with my vote on `paperId` set to `decision` (moved to the end, like an upsert). */
export function applyVote(
  votes: readonly Vote[],
  paperId: string,
  me: string,
  decision: SwipeDecision,
): Vote[] {
  return [
    ...votes.filter((x) => !(x.paperId === paperId && x.userId === me)),
    { paperId, userId: me, decision },
  ];
}

/** "You" for me, the display name if set, otherwise "Member N" by join order. */
export function memberLabels(
  members: readonly { userId: string; displayName: string | null }[],
  me: string | undefined,
): Map<string, string> {
  return new Map(
    members.map(({ userId, displayName }, i) => [
      userId,
      userId === me ? "You" : displayName?.trim() || `Member ${i + 1}`,
    ]),
  );
}
