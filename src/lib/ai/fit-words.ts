/**
 * Keeping card text within its word limit without ever cutting a sentence in half. Pure helpers
 * for `paper-analysis.ts`: drop whole sentences when that's enough, and check that a model
 * rewrite ("make it concise") adds no facts the original didn't have.
 */
import { NOT_STATED, countWords } from "./schemas";

// A "." after these is not a sentence end ("ca. 300", "Dr. Stevens", "Sept. 2019").
const ABBREVIATION =
  /(?:^|\s|\()(?:e\.g|i\.e|etc|vs|cf|al|approx|fig|figs|no|nos|vol|ca|c|dr|prof|mr|mrs|ms|st|jr|eq|eqs|pp|resp|est|sec|ch|incl|dept|univ|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i;
const INITIAL = /(?:^|[\s.(])\p{L}$/u;
// A token with an inner dot is an abbreviation too: "M.Sc", "Ph.D".
const DOTTED = /(?:^|\s|\()\p{L}+\.\p{L}+$/u;

/** Sentences, keeping their end marks. Text with no end mark is one unit. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?]+(?=\s+["'“(]?[\p{Lu}\d])/gu)) {
    const end = match.index + match[0].length;
    const before = text.slice(start, match.index);
    // "..." trails off; it doesn't end a sentence.
    if (/^\.{2,}$/.test(match[0])) continue;
    if (
      match[0] === "." &&
      (ABBREVIATION.test(before) || INITIAL.test(before) || DOTTED.test(before))
    )
      continue;
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
const NUMBER_WORDS = new Set(
  (
    "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen " +
    "sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety " +
    "hundred thousand million billion half twice thrice dozen double triple"
  ).split(" "),
);
// Ordinary openers a rewrite may start a sentence with even if the original didn't use them.
const OPENERS = new Set(
  (
    "the a an this these that those it its in among most some each both while when after " +
    "before over under for of with from by as at on to and but or however overall yet such"
  ).split(" "),
);

export function introducesNewFacts(original: string, rewrite: string): boolean {
  const known = numbers(original);
  for (const n of numbers(rewrite)) if (!known.has(n)) return true;
  const letters = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const originalLetters = new Set(letters(original));
  // "three-wave" → "five-wave", "twice" → "three times": number words must come from the original.
  for (const w of letters(rewrite)) if (NUMBER_WORDS.has(w) && !originalLetters.has(w)) return true;
  const originalWords = new Set(original.toLowerCase().match(/\p{L}[\p{L}'-]*/gu) ?? []);
  const tokens = rewrite.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const sentenceStart = i === 0 || /[.!?]["')]?$/.test(tokens[i - 1]!);
    for (const word of tokens[i]!.match(/\p{L}[\p{L}'-]*/gu) ?? []) {
      const lower = word.toLowerCase();
      // A capital at a sentence start is only grammar if the word is ordinary or already given;
      // otherwise it may be a new name ("Orben found…").
      if (sentenceStart && tokens[i]!.startsWith(word)) {
        if (!OPENERS.has(lower) && !originalWords.has(lower)) return true;
        continue;
      }
      if (/^\p{Lu}/u.test(word) && !originalWords.has(lower)) return true;
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
  // "about the." still dangles: ignore a closing mark when reading the last word.
  const last = t.toLowerCase().match(/(\p{L}+)[.!?]*$/u)?.[1];
  return last !== undefined && DANGLING.has(last);
}
