import type { Paper } from "@/types/domain";
import { plainText } from "./cite-key";
import { normaliseDoi } from "./doi";

/**
 * BibTeX entries (LB-02), always rendered by code: either built from our retrieved `Paper`
 * metadata, or a doi.org/Crossref answer that passes `rekeyEntry`'s checks. Never from Claude.
 */

const LATEX_SPECIALS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  // \{ and \} would unbalance BibTeX's brace count (it ignores backslashes); these don't.
  "{": "\\textbraceleft{}",
  "}": "\\textbraceright{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

// pdflatex (Overleaf's default) stops on most non-Latin characters and prints < > | as other
// glyphs; map what scientific titles commonly carry. Other scripts need XeLaTeX/LuaLaTeX.
const GREEK =
  "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi o pi rho varsigma sigma tau upsilon phi chi psi omega";
const LATEX_UNICODE: Record<string, string> = {
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
  "−": "-",
  "≥": "$\\geq$",
  "≤": "$\\leq$",
  "≠": "$\\neq$",
  "×": "$\\times$",
  "±": "$\\pm$",
  "∼": "$\\sim$",
  "≈": "$\\approx$",
  "→": "$\\rightarrow$",
  "°": "\\textdegree{}",
  µ: "$\\mu$",
  "¹": "\\textsuperscript{1}",
  "²": "\\textsuperscript{2}",
  "³": "\\textsuperscript{3}",
  Γ: "$\\Gamma$",
  Δ: "$\\Delta$",
  Θ: "$\\Theta$",
  Λ: "$\\Lambda$",
  Ξ: "$\\Xi$",
  Π: "$\\Pi$",
  Σ: "$\\Sigma$",
  Φ: "$\\Phi$",
  Ψ: "$\\Psi$",
  Ω: "$\\Omega$",
  Υ: "$\\Upsilon$",
  // Capitals that look Latin are written as the Latin letter.
  ...Object.fromEntries([..."ΑΒΕΖΗΙΚΜΝΟΡΤΧ"].map((ch, i) => [ch, "ABEZHIKMNOPTX"[i]!])),
  ...Object.fromEntries(
    GREEK.split(" ").map((name, i) => [
      String.fromCodePoint(0x3b1 + i),
      name === "o" ? "o" : `$\\${name}$`,
    ]),
  ),
};

// Control characters, soft hyphens and zero-width characters: invisible, and fatal to pdflatex.
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u00ad\u200b-\u200d\u2060\ufeff]/g;

export const escapeLatex = (text: string) =>
  text
    .replace(INVISIBLE, "")
    .replace(
      /[\\{}&%$#_~^<>|−≥≤≠×±∼≈→°µ¹²³\u0391-\u03c9]/g,
      (ch) => LATEX_SPECIALS[ch] ?? LATEX_UNICODE[ch] ?? ch,
    );

/** A capital after the first letter (UK, COVID-19, iPhone): brace it so styles keep its case. */
const needsProtection = (word: string) => /\p{Lu}/u.test(word.replace(/^\P{L}+/u, "").slice(1));

/** Escaped title text with case-sensitive words braced. */
export const latexTitle = (title: string) =>
  plainText(title)
    .split(/(\s+)/)
    .map((part) => (needsProtection(part) ? `{${escapeLatex(part)}}` : escapeLatex(part)))
    .join("");

const ORGANISATION =
  /\b(and|group|consortium|collaboration|collaborative|committee|organi[sz]ation|association|society|institute|council|network|team|investigators|universit\w*|department|cent(?:re|er)|laborator\w*|foundation|hospital|ministry|agency)\b/i;

/**
 * BibTeX splits names on " and " and reads commas as Last, First; braces keep an organisation
 * (or anything with 2+ commas) as one literal name.
 */
const latexName = (name: string) => {
  const escaped = escapeLatex(name.trim());
  const commas = name.split(",").length - 1;
  return ORGANISATION.test(name) || commas >= 2 ? `{${escaped}}` : escaped;
};

const field = (name: string, value: string) => `  ${name} = ${value},`;

/**
 * Verbatim fields (doi, url) can't be escaped; drop a value whose braces would break the entry
 * or whose % / # break `\url` inside macro arguments.
 */
/** http(s), printable ASCII only (pdflatex), none of the characters that break `\url{}`. */
/** Printable ASCII only (pdflatex), none of the characters that break `\url{}` or the entry. */
const verbatimSafe = (value: string | undefined) =>
  value && /^[\x21-\x7e]+$/.test(value) && !/[{}\\%#]/.test(value) ? value : undefined;
/** As above, and http(s) only: no `javascript:` or `data:` links in any export. */
const urlSafe = (value: string | undefined) =>
  value && /^https?:\/\//i.test(value) ? verbatimSafe(value) : undefined;
const verbatim = (value: string | undefined) => {
  const safe = verbatimSafe(value);
  return safe && `{${safe}}`;
};

/** The paper's DOI in bare form, if it has a valid one. */
export const paperDoi = (paper: Paper) =>
  paper.doi ? (normaliseDoi(paper.doi) ?? undefined) : undefined;

/** A link safe to put in `\url{}` (and in every other export): the paper's url, else its DOI. */
export const paperUrl = (paper: Paper) => {
  const doi = paperDoi(paper);
  return urlSafe(paper.url) ?? urlSafe(doi && `https://doi.org/${doi}`);
};

export function buildEntry(paper: Paper, key: string): string {
  const authors = paper.authors.map((a) => a.name).filter((n) => n.trim());
  const doi = paperDoi(paper);
  const url = verbatim(paperUrl(paper));
  const fields: [string, string | undefined][] = [
    ["author", authors.length ? `{${authors.map(latexName).join(" and ")}}` : undefined],
    ["title", `{${latexTitle(paper.title)}}`],
    ["journal", paper.venue ? `{${escapeLatex(paper.venue)}}` : undefined],
    ["year", paper.year === undefined ? undefined : `{${paper.year}}`],
    ["doi", verbatim(doi)],
    ["url", url],
  ];
  return render(paper.venue ? "article" : "misc", key, fields);
}

function render(type: string, key: string, fields: [string, string | undefined][]) {
  const lines = fields.flatMap(([name, value]) =>
    value === undefined ? [] : [field(name, value)],
  );
  return [`@${type}{${key},`, ...lines, "}"].join("\n");
}

// Fetched text is external: only these control sequences may appear in it. Anything else
// (\input, \write18, \scantokens, \csname, …) could read files or run commands when the .bib is
// compiled, so the entry falls back to buildEntry. An allowlist, because denylists leak.
const ALLOWED_SYMBOLS = new Set([..."'\"`^~=.&%$#_{} -"]);
const ALLOWED_WORDS = new Set(
  "u v H c d b t r k i j o O l L ss ae AE oe OE aa AA textendash textemdash textit textbf emph textsc textsuperscript textsubscript textbraceleft textbraceright textasciitilde textasciicircum textbackslash mathrm".split(
    " ",
  ),
);

function onlySafeTex(text: string): boolean {
  if (text.includes("^^")) return false; // ^^5c is a backslash in TeX
  for (let i = text.indexOf("\\"); i !== -1; i = text.indexOf("\\", i + 1)) {
    const word = /^[A-Za-z]+/.exec(text.slice(i + 1))?.[0];
    if (word ? !ALLOWED_WORDS.has(word) : !ALLOWED_SYMBOLS.has(text[i + 1] ?? "")) return false;
    i += word ? word.length : 1;
  }
  return true;
}

// Skipping follows BibTeX's own rules, which ignore backslashes: every { and } counts, and a
// quoted value ends at the first " at depth 0. Anything else would let a value that looks
// balanced to us end early for BibTeX and smuggle in a second entry or @preamble.

/** Index just past a balanced `{…}` starting at `start`, or -1. */
function skipBraced(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/** Index just past a `"…"` value starting at `start` (braces inside must balance), or -1. */
function skipQuoted(text: string, start: number): number {
  let depth = 0;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return -1;
    else if (ch === '"' && depth === 0) return i + 1;
  }
  return -1;
}

const LINKING_FIELDS = new Set(["crossref", "xdata", "related", "ids", "xref"]);

/** Parses exactly one `@type{key, name = value, … }` entry; null for anything else. */
function parseEntry(text: string): { type: string; fields: [string, string][] } | null {
  const head = /^\s*@([A-Za-z]+)\s*\{\s*[^,\s{}]*\s*,/.exec(text);
  if (!head) return null;
  const type = head[1]!.toLowerCase();
  if (type === "comment" || type === "string" || type === "preamble") return null;

  const fields: [string, string][] = [];
  let i = head[0].length;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  for (;;) {
    ws();
    if (text[i] === "}") break;
    const name = /^[A-Za-z][\w-]*/.exec(text.slice(i))?.[0];
    if (!name) return null;
    i += name.length;
    ws();
    if (text[i] !== "=") return null;
    i++;
    ws();
    const start = i;
    if (text[i] === "{") i = skipBraced(text, i);
    else if (text[i] === '"') i = skipQuoted(text, i);
    else i += /^[\w.:-]+/.exec(text.slice(i))?.[0].length ?? 0;
    if (i <= start) return null;
    // Cross-reference fields would pull fields in from other entries in the user's file.
    if (!LINKING_FIELDS.has(name.toLowerCase())) {
      fields.push([name.toLowerCase(), text.slice(start, i)]);
    }
    ws();
    if (text[i] === ",") i++;
    else if (text[i] !== "}") return null; // e.g. `#` concatenation
  }
  if (text.slice(i + 1).trim() !== "") return null;
  if (!fields.some(([name]) => name === "title")) return null;
  return { type, fields };
}

/**
 * Validates a fetched entry and swaps its key for ours, one field per line.
 * Null when it isn't exactly one well-formed entry with a title, or uses TeX outside the allowlist.
 */
export function rekeyEntry(text: string, key: string): string | null {
  // An unescaped % or # breaks compiling the .bbl (a comment / macro parameter).
  if (!onlySafeTex(text) || /(^|[^\\])[%#]/.test(text)) return null;
  const entry = parseEntry(text);
  return entry && render(entry.type, key, entry.fields);
}
