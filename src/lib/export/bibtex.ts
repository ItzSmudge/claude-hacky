import type { Paper } from "@/types/domain";

/**
 * BibTeX entries (LB-02), always rendered by code: either built from our retrieved `Paper`
 * metadata, or a doi.org/Crossref answer that passes `rekeyEntry`'s checks. Never from Claude.
 */

const LATEX_SPECIALS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export const escapeLatex = (text: string) =>
  text.replace(/[\\{}&%$#_~^]/g, (ch) => LATEX_SPECIALS[ch] ?? ch);

/** A capital after the first letter (UK, COVID-19, iPhone): brace it so styles keep its case. */
const needsProtection = (word: string) => /\p{Lu}/u.test(word.replace(/^\P{L}+/u, "").slice(1));

/** Escaped title text with case-sensitive words braced. */
export const latexTitle = (title: string) =>
  title
    .split(/(\s+)/)
    .map((part) => (needsProtection(part) ? `{${escapeLatex(part)}}` : escapeLatex(part)))
    .join("");

const ORGANISATION =
  /\b(and|group|consortium|collaboration|collaborative|committee|organi[sz]ation|association|society|institute|council|network|team|investigators)\b/i;

/** BibTeX splits names on " and "; braces keep an organisation as one literal name. */
const latexName = (name: string) => {
  const escaped = escapeLatex(name.trim());
  return ORGANISATION.test(name) ? `{${escaped}}` : escaped;
};

const field = (name: string, value: string) => `  ${name} = ${value},`;

/** Verbatim fields (doi, url) can't be escaped; drop a value whose braces would break the entry. */
const verbatim = (value: string | undefined) =>
  value && !/[{}\\]/.test(value) ? `{${value}}` : undefined;

export function buildEntry(paper: Paper, key: string): string {
  const authors = paper.authors.map((a) => a.name).filter((n) => n.trim());
  const url = paper.url ?? (paper.doi ? `https://doi.org/${paper.doi}` : undefined);
  const fields: [string, string | undefined][] = [
    ["author", authors.length ? `{${authors.map(latexName).join(" and ")}}` : undefined],
    ["title", `{${latexTitle(paper.title)}}`],
    ["journal", paper.venue ? `{${escapeLatex(paper.venue)}}` : undefined],
    ["year", paper.year === undefined ? undefined : `{${paper.year}}`],
    ["doi", verbatim(paper.doi)],
    ["url", verbatim(url)],
  ];
  return render(paper.venue ? "article" : "misc", key, fields);
}

function render(type: string, key: string, fields: [string, string | undefined][]) {
  const lines = fields.flatMap(([name, value]) =>
    value === undefined ? [] : [field(name, value)],
  );
  return [`@${type}{${key},`, ...lines, "}"].join("\n");
}

// Primitives that read/write files, run shell commands or redefine macros when the .bib is
// compiled (e.g. with --shell-escape). Fetched entries containing them fall back to buildEntry.
const DANGEROUS_TEX =
  /\\(?:immediate|write|input|include|openin|openout|read|catcode|def|edef|gdef|xdef|let|csname|directlua|latelua|special|newcommand|renewcommand|providecommand|usepackage|documentclass|makeatletter)(?![a-zA-Z])|\^\^/;

/** Index just past a balanced `{…}` starting at `start`, or -1. */
function skipBraced(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") i++;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/** Index just past a `"…"` value starting at `start` (braces inside must balance), or -1. */
function skipQuoted(text: string, start: number): number {
  let depth = 0;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") i++;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return -1;
    else if (ch === '"' && depth === 0) return i + 1;
  }
  return -1;
}

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
    fields.push([name.toLowerCase(), text.slice(start, i)]);
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
 * Null when it isn't exactly one well-formed entry with a title, or carries dangerous TeX.
 */
export function rekeyEntry(text: string, key: string): string | null {
  if (DANGEROUS_TEX.test(text)) return null;
  const entry = parseEntry(text);
  return entry && render(entry.type, key, entry.fields);
}
