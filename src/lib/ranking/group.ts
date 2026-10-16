import { z } from "zod";
import type { SwipeDecision } from "@/types/domain";
import { learnWeights, type SwipeSample, type Weights } from "./weights";

/**
 * Group mode (RK-04): rank each person's deck by the whole group's swipes.
 * Pure, like weights.ts: everything is rebuilt from histories, so a teammate's undo is a shorter one.
 */

const DEFAULT_TEAM_WEIGHT = 0.5;

/**
 * My weights plus `teamWeight` × the mean of each teammate's own weights. A mean, so a big group
 * nudges the order as much as one teammate would, and never drowns out my own taste.
 */
export function combineWeights(
  own: SwipeSample[],
  teammates: SwipeSample[][],
  { teamWeight = DEFAULT_TEAM_WEIGHT, decay }: { teamWeight?: number; decay?: number } = {},
): Weights {
  const combined = learnWeights(own, { decay });
  const active = teammates.filter((history) => history.length > 0);
  const scale = teamWeight / (active.length || 1);
  for (const history of active) {
    for (const [id, w] of learnWeights(history, { decay })) {
      combined.set(id, (combined.get(id) ?? 0) + w * scale);
    }
  }
  return combined;
}

/**
 * `next`, but with the first `n` cards of `previous` (those still in `next`) left on top, so a
 * teammate's swipe never moves the card someone is looking at or about to see.
 */
export function keepHead<T>(
  previous: T[],
  next: T[],
  n = 2,
  key: (item: T) => unknown = (item) => item,
): T[] {
  const byKey = new Map(next.map((item) => [key(item), item]));
  const head = previous.slice(0, n).flatMap((item) => {
    const kept = byKey.get(key(item));
    return kept === undefined ? [] : [kept];
  });
  const pinned = new Set(head.map(key));
  return [...head, ...next.filter((item) => !pinned.has(key(item)))];
}

/**
 * The deck's next order: `next` as is after anything I did (swipe, undo, filter — compared by
 * identity in `mine`), otherwise with the top `n` cards of the last order kept, so a teammate's swipe
 * or a paper's analysis landing never moves the card I'm looking at or the one under it.
 */
export function pinnedOrder<T>(
  last: { mine: readonly unknown[]; ranked: T[] } | null,
  mine: readonly unknown[],
  next: T[],
  key?: (item: T) => unknown,
  n = 2,
): T[] {
  if (!last || last.mine.some((input, i) => input !== mine[i])) return next;
  return keepHead(last.ranked, next, n, key);
}

/** Each teammate's decisions by paper, in the order they first swiped it. */
export type TeamDecisions = Map<string, Map<string, SwipeDecision>>;

/** One teammate's swipe arriving live; `decision: null` means they took it back. */
export interface TeamSwipeChange {
  userId: string;
  paperId: string;
  decision: SwipeDecision | null;
}

/** Teammates' swipes as loaded with the page, oldest first. */
export function teamDecisionsFrom(
  rows: { userId: string; paperId: string; decision: SwipeDecision }[],
): TeamDecisions {
  return rows.reduce<TeamDecisions>((team, row) => applyTeamChange(team, row), new Map());
}

const swipeKey = z.object({ project_id: z.string(), paper_id: z.string(), user_id: z.string() });
const changePayload = z.discriminatedUnion("eventType", [
  z.object({ eventType: z.literal("DELETE"), old: swipeKey }),
  z.object({
    eventType: z.enum(["INSERT", "UPDATE"]),
    new: swipeKey.extend({ decision: z.enum(["save", "skip"]) }),
  }),
]);

/**
 * A Realtime change on `swipes` → the teammate's swipe it represents, or null (mine, another
 * project's, malformed). An undo's DELETE carries only the primary key, which is all we need.
 */
export function teamSwipeChange(
  payload: unknown,
  { projectId, me }: { projectId: string; me: string },
): TeamSwipeChange | null {
  const parsed = changePayload.safeParse(payload);
  if (!parsed.success) return null;
  const row = parsed.data.eventType === "DELETE" ? parsed.data.old : parsed.data.new;
  if (row.project_id !== projectId || row.user_id === me) return null;
  const decision = parsed.data.eventType === "DELETE" ? null : parsed.data.new.decision;
  return { userId: row.user_id, paperId: row.paper_id, decision };
}

/** A new map with the change applied: a changed mind keeps its place, an undo drops it. */
export function applyTeamChange(team: TeamDecisions, change: TeamSwipeChange): TeamDecisions {
  const next = new Map(team);
  const papers = new Map(team.get(change.userId));
  if (change.decision) papers.set(change.paperId, change.decision);
  else papers.delete(change.paperId);
  if (papers.size) next.set(change.userId, papers);
  else next.delete(change.userId);
  return next;
}
