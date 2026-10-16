/**
 * Keeping card text within its word limit without ever cutting a sentence in half. Pure helpers
 * for `paper-analysis.ts`: drop whole sentences when that's enough, and check that a model
 * rewrite ("make it concise") adds no facts the original didn't have.
 */
import { NOT_STATED, countWords } from "./schemas";

// A "." after these is not a sentence end.
const ABBREVIATION = /(?:^|\s|\()(?:e\.g|i\.e|etc|vs|cf|al|approx|fig|no|vol)$/i;
const INITIAL = /(?:^|[\s.(])\p{L}$/u;

/** Sentences, keeping their end marks. Text with no end mark is one unit. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?]+(?=\s+["'“(]?[\p{Lu}\d])/gu)) {
    const end = match.index + match[0].length;
    const before = text.slice(start, match.index);
    if (match[0] === "." && (ABBREVIATION.test(before) || INITIAL.test(before))) continue;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * `text` if it fits; otherwise the longest run of whole sentences from the start that fits, or
 * `null` when even the first sentence is too long (the caller then asks for a concise rewrite).
 */
export function clampToSentences(text: string, max: number): string | null {
  if (text === NOT_STATED || countWords(text) <= max) return text;
  const kept: string[] = [];
  let words = 0;
  for (const sentence of splitSentences(text)) {
    const n = countWords(sentence);
    if (words + n > max) break;
    kept.push(sentence);
    words += n;
  }
  return kept.length ? kept.join(" ") : null;
}

const numbers = (text: string) =>
  new Set([...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, "")));

/**
 * True if `rewrite` brings in a number, year or capitalised name that `original` doesn't have:
 * a shortened field may only reuse what the model already wrote (and the paper already said).
 */
export function introducesNewFacts(original: string, rewrite: string): boolean {
  const known = numbers(original);
  for (const n of numbers(rewrite)) if (!known.has(n)) return true;
  const originalWords = new Set(original.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []);
  const tokens = rewrite.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const sentenceStart = i === 0 || /[.!?]["')]?$/.test(tokens[i - 1]!);
    for (const word of tokens[i]!.match(/\p{L}[\p{L}'-]*/gu) ?? []) {
      if (sentenceStart && tokens[i]!.startsWith(word)) continue;
      if (/^\p{Lu}/u.test(word) && !originalWords.has(word.toLowerCase())) return true;
    }
  }
  return false;
}

const DANGLING = new Set(
  "and or but nor of the a an to with for in on at by from that which as than into about".split(
    " ",
  ),
);

/** True if text stops part-way: trailing , ; : dash or ellipsis, or a dangling joining word. */
export function endsMidClause(text: string): boolean {
  const t = text.trim();
  if (!t || t === NOT_STATED) return false;
  if (/[,;:—–-]$|…$|\.\.\.$/.test(t)) return true;
  const last = t.toLowerCase().match(/(\p{L}+)$/u)?.[1];
  return last !== undefined && DANGLING.has(last);
}
