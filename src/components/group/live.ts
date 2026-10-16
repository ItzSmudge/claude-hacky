// GR-02: who's swiping right now, and what teammates just saved.
import { z } from "zod";

/** "3 swiping" / "You and 2 others are swiping now", or null when nobody else is here. */
export function presenceText(
  keys: readonly string[],
  me: string,
): { short: string; long: string } | null {
  const others = new Set(keys);
  others.delete(me);
  const n = others.size;
  if (n === 0) return null;
  return {
    short: `${n + 1} swiping`,
    long: `You and ${n} ${n === 1 ? "other" : "others"} are swiping now`,
  };
}

const swipeRow = z.object({
  paper_id: z.string(),
  user_id: z.string(),
  decision: z.string(),
});

/** A realtime swipes row → the teammate's save it represents, or null (mine, a skip, malformed). */
export function teammateSave(row: unknown, me: string): { paperId: string; userId: string } | null {
  const parsed = swipeRow.safeParse(row);
  if (!parsed.success) return null;
  const { paper_id: paperId, user_id: userId, decision } = parsed.data;
  if (userId === me || decision !== "save") return null;
  return { paperId, userId };
}

const TITLE_MAX = 45;

/** "Priya saved “Title…”" (titles cut on a word boundary). */
export function feedText(label: string, title: string | undefined): string {
  if (!title) return `${label} saved a paper`;
  let short = title;
  if (title.length > TITLE_MAX) {
    const cut = title.slice(0, TITLE_MAX);
    // Drop a word the cut went through, unless the cut fell exactly between words.
    const whole = /\s/.test(title[TITLE_MAX]) ? cut : cut.replace(/\s+\S*$/, "");
    short = `${whole.replace(/[\s,;:]+$/, "")}…`;
  }
  return `${label} saved “${short}”`;
}

export interface FeedItem {
  userId: string;
  label: string;
  title: string | undefined;
}

/** One line for a batch of teammates' saves: the single save, "Priya saved 3 papers", or "Priya and 2 others saved 5 papers". */
export function feedSummary(items: readonly FeedItem[]): string {
  if (items.length === 1) return feedText(items[0].label, items[0].title);
  const people = [...new Map(items.map((i) => [i.userId, i.label])).values()];
  const papers = `${items.length} papers`;
  if (people.length === 1) return `${people[0]} saved ${papers}`;
  const others = people.length - 1;
  return `${people[0]} and ${others} ${others === 1 ? "other" : "others"} saved ${papers}`;
}
