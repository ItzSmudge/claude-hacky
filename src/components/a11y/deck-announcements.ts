import type { SwipeDecision } from "@/types/domain";

/**
 * Screen-reader messages for the swipe deck (AX-01). Pure, unit tested.
 * Titles are always the paper's own (scholar data), never model text.
 */

const TITLE_MAX = 100;

/** A title fit to be spoken mid-sentence: one line, not too long, no trailing full stop. */
export function spokenTitle(title: string | null | undefined): string {
  const flat = (title ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "Untitled paper";
  if (flat.length > TITLE_MAX) {
    const cut = flat.slice(0, TITLE_MAX);
    const space = cut.lastIndexOf(" ");
    return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }
  return flat.replace(/[.,;:]+$/, "");
}

/** Ends a phrase with a full stop unless the title already ends a sentence ("?", "!", "…"). */
const sentence = (text: string) => (/[.?!…]$/.test(text) ? text : `${text}.`);

/**
 * After save/skip. `left` counts the cards still to decide, `next` is the new top card's title,
 * `loading` says whether more papers are on their way when the deck has run out.
 */
export function decisionMessage({
  decision,
  title,
  next,
  left,
  loading = false,
}: {
  decision: SwipeDecision;
  title: string;
  next: string | null;
  left: number;
  loading?: boolean;
}): string {
  const done = sentence(`${decision === "save" ? "Saved" : "Skipped"}: ${spokenTitle(title)}`);
  if (next === null || left <= 0) {
    return `${done} ${loading ? "Loading more papers." : "That was the last paper."}`;
  }
  return `${done} ${sentence(`Next: ${spokenTitle(next)}`)} ${left} left.`;
}

export function undoMessage({ title, left }: { title: string; left: number }): string {
  return `${sentence(`Restored: ${spokenTitle(title)}`)} ${left} left.`;
}

/** A top card appeared on an empty deck: the first load, or more papers after the deck ran out. */
export function arrivalMessage({ title, first }: { title: string; first: boolean }): string {
  return first
    ? `Papers ready. ${sentence(`First: ${spokenTitle(title)}`)}`
    : `More papers ready. ${sentence(`Next: ${spokenTitle(title)}`)}`;
}

/** Loading finished with nothing to show. `seen` is how many papers the deck has shown so far. */
export function nothingLeftMessage(seen: number): string {
  return seen === 0 ? "No papers to swipe yet." : "No more papers found.";
}
