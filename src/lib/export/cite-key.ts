import type { Paper } from "@/types/domain";

/**
 * Readable cite keys: `lastnameYEARword` (LB-02), e.g. `boer2020social`. Built by code from
 * retrieved metadata only; LB-03's `\cite{}` copy uses the same keys. Stable for a given set of
 * papers: adding a paper with a smaller id and the same base key moves the b/c suffixes.
 * Fully stable keys would need persisting (a later migration).
 */

// Letters NFD can't decompose into base + accent.
const SPECIAL_LETTERS: Record<string, string> = {
  ø: "o",
  Ø: "O",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ß: "ss",
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  þ: "th",
  Þ: "Th",
  ı: "i",
};

export const asciiFold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[øØæÆœŒßłŁđĐðÐþÞı]/g, (ch) => SPECIAL_LETTERS[ch] ?? ch);

/** OpenAlex titles can carry markup such as `<i>E. coli</i>`; keep the text only. */
export const stripTags = (text: string) => text.replace(/<[^>]*>/g, "");

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/** The family name as written: before the comma of "Last, First", else the last non-suffix word. */
export function familyName(name: string): string {
  const comma = name.indexOf(",");
  if (comma > 0) return name.slice(0, comma).trim();
  const words = name.trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words.at(-1)!.toLowerCase().replace(/\.$/, ""))) {
    words.pop();
  }
  return words.at(-1) ?? "";
}

const STOPWORDS = new Set(
  "a an the of on in and or for to with from by at as is are be its into about towards toward via vs versus".split(
    " ",
  ),
);

/** Lowercase ASCII letters only: "Finserås" → "finseras", "trans-diagnostic" → "transdiagnostic". */
const slug = (text: string) =>
  asciiFold(text)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

export function citeKey(paper: Paper): string {
  const first = paper.authors[0]?.name;
  const name = (first && slug(familyName(first))) || "anon";
  const y = paper.year;
  const year = y !== undefined && Number.isInteger(y) && y > 0 && y < 10_000 ? y : "nd";
  const word =
    stripTags(paper.title)
      .split(/\s+/)
      .map(slug)
      .find((w) => w.length > 1 && !STOPWORDS.has(w)) ?? "untitled";
  return `${name}${year}${word}`;
}

/** Keys for a set of papers. Collisions get b, c… in paper-id order, so input order never matters. */
export function citeKeys(papers: readonly Paper[]): Map<string, string> {
  const keys = new Map<string, string>();
  const used = new Set<string>();
  const sorted = [...papers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const paper of sorted) {
    if (keys.has(paper.id)) continue;
    const base = citeKey(paper);
    let key = base;
    for (let i = 1; used.has(key); i++) key = base + suffix(i);
    used.add(key);
    keys.set(paper.id, key);
  }
  return keys;
}

/** 1 → "b", 2 → "c", … 24 → "z", 25 → "zb": always letters, so keys stay `[a-z]+`. */
const suffix = (i: number): string =>
  i <= 24 ? String.fromCharCode(97 + i) : "z" + suffix(i - 24);
