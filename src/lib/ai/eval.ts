/**
 * AI-06: code checks for bibliographic data the model may have invented in card text. The zod
 * schema already enforces word limits and bans links/DOIs (and `askJson` repairs once), so these
 * look for what it can't see: author names, years, titles, citations and ungrounded numbers.
 * Pure: no API calls. Used by `paper-analysis.eval.live.test.ts`.
 */
import type { Paper, PaperAnalysis, ProjectContext } from "@/types/domain";
import { NOT_STATED, countWords } from "./schemas";

export interface EvalIssues {
  failures: string[];
  warnings: string[];
}

export interface EvalRow {
  paperId: string;
  relevance?: number;
  repaired: boolean;
  issues: EvalIssues;
  /** The model call itself failed (refusal, invalid output after repair, …); counts as a failure. */
  error?: string;
}

// Mirrors paperAnalysisOutputSchema's word limits.
const LIMITS = {
  overview: 35,
  whyItMatters: 20,
  relevanceReason: 8,
  methodology: 15,
  limitations: 15,
} as const;
const NOTE_LIMIT = 12;
const TITLE_RUN = 6;

const LINK = /\bhttps?:\/\/|\bwww\.\S/i;
const DOI = /\b10\.\d{4,9}\/\S/;
const ET_AL = /\bet al\b/i;
const PAREN_CITATION = /\(\s*[A-Z][\p{L}'-]+,?\s+(?:19|20)\d{2}\s*\)/u;
const YEAR = /\b(?:19|20)\d{2}\b/g;
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Lowercase, punctuation → spaces, collapsed; so "use, problems" matches "use problems". */
const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const wordSet = (text: string) => new Set(norm(text).split(" ").filter(Boolean));

/** Every run of `n` consecutive words. */
function runs(text: string, n: number): string[] {
  const w = norm(text).split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" "));
  return out;
}

const numbersIn = (text: string) =>
  new Set([...text.matchAll(NUMBER)].map((m) => m[0].replace(/,/g, "").replace(/\.$/, "")));

/** What the model was shown about the paper (see paperBlock in paper-analysis.ts). */
const sourceOf = (paper: Paper) =>
  [
    paper.title,
    paper.abstract ?? "",
    paper.venue ?? "",
    ...paper.topics,
    paper.year ?? "",
    paper.tldr ?? "",
  ].join(" \n ");

/** Author surnames worth checking: last name token, ≥ 3 letters, not an ordinary word in the abstract. */
function surnames(paper: Paper): string[] {
  const abstractWords = wordSet(paper.abstract ?? "");
  return [
    ...new Set(
      paper.authors
        .map((a) => norm(a.name).split(" ").pop() ?? "")
        .filter((s) => s.length >= 3 && !abstractWords.has(s)),
    ),
  ];
}

export function checkAnalysis(
  paper: Paper,
  analysis: PaperAnalysis,
  {
    others,
    context,
    repaired = false,
  }: { others: Paper[]; context: ProjectContext; repaired?: boolean },
): EvalIssues {
  const failures: string[] = [];
  const warnings: string[] = [];

  const fields: [string, string, number][] = [
    ...(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map(
      (key) => [key, analysis[key], LIMITS[key]] as [string, string, number],
    ),
    ...analysis.stances.map(
      (s) => [`stance ${s.claimId} note`, s.note, NOTE_LIMIT] as [string, string, number],
    ),
  ];
  const source = sourceOf(paper);
  const sourceYears = new Set(source.match(YEAR) ?? []);
  const sourceNumbers = numbersIn(source);
  const names = surnames(paper);
  const titleRuns = new Map<string, string>();
  for (const p of [paper, ...others])
    for (const run of runs(p.title, TITLE_RUN)) titleRuns.set(run, p.id);

  for (const [name, text] of fields) {
    const padded = ` ${norm(text)} `;
    if (LINK.test(text) || DOI.test(text)) failures.push(`${name}: contains a link or DOI`);
    for (const surname of names)
      if (padded.includes(` ${surname} `)) failures.push(`${name}: names author "${surname}"`);
    const copied = [...titleRuns.keys()].find((run) => padded.includes(` ${run} `));
    if (copied)
      failures.push(
        `${name}: copies a paper title ("${copied}"${titleRuns.get(copied) === paper.id ? ", its own" : ""})`,
      );
    if (ET_AL.test(text) || PAREN_CITATION.test(text))
      failures.push(`${name}: contains a citation`);
    for (const year of text.match(YEAR) ?? [])
      if (!sourceYears.has(year)) failures.push(`${name}: year ${year} is not in the source`);
  }

  const claimIds = context.claims.map((c) => c.id);
  const stanceIds = analysis.stances.map((s) => s.claimId);
  const sameClaims =
    stanceIds.length === claimIds.length &&
    new Set(stanceIds).size === stanceIds.length &&
    claimIds.every((id) => stanceIds.includes(id));
  if (!sameClaims)
    failures.push(
      `stances: expected one per claim [${claimIds.join(", ")}], got [${stanceIds.join(", ")}]`,
    );

  if (!paper.abstract) {
    for (const key of ["overview", "methodology", "limitations"] as const)
      if (analysis[key] !== NOT_STATED)
        failures.push(`${key}: no abstract, but not "${NOT_STATED}"`);
    if (analysis.stances.some((s) => s.stance !== "unclear"))
      failures.push("stances: no abstract, but a stance is not unclear");
  }

  // Warnings skip "not stated" fields and the (placeholder) notes on unclear stances.
  const unclear = new Set(
    analysis.stances.filter((s) => s.stance === "unclear").map((s) => `stance ${s.claimId} note`),
  );
  for (const [name, text, limit] of fields) {
    if (text === NOT_STATED || unclear.has(name)) continue;
    for (const n of numbersIn(text)) {
      if (/^(?:19|20)\d{2}$/.test(n)) continue; // years are checked above
      if (!sourceNumbers.has(n)) warnings.push(`${name}: number ${n} is not in the source`);
    }
    const count = countWords(text);
    if (count >= limit - 1) warnings.push(`${name}: ${count}/${limit} words, at the limit`);
  }
  if (repaired) warnings.push("needed a repair retry");

  return { failures, warnings };
}

/** One line per paper, then totals; for the live eval's console output and the PR. */
export function formatEvalReport(
  rows: EvalRow[],
  usage: { input: number; output: number; cacheRead: number },
): string {
  const lines = rows.map((row) => {
    const failed = row.error !== undefined || row.issues.failures.length > 0;
    const notes = [
      ...(row.error ? [`error: ${row.error}`] : []),
      ...row.issues.failures.map((f) => `✗ ${f}`),
      ...row.issues.warnings.map((w) => `! ${w}`),
    ];
    const rel = row.relevance === undefined ? "  -" : String(row.relevance).padStart(3);
    return [
      `${failed ? "FAIL" : "PASS"}  ${row.paperId.padEnd(34)} rel ${rel}${row.repaired ? "  repaired" : ""}`,
      ...notes.map((n) => `        ${n}`),
    ].join("\n");
  });
  const failures = rows.reduce((n, r) => n + r.issues.failures.length + (r.error ? 1 : 0), 0);
  const warnings = rows.reduce((n, r) => n + r.issues.warnings.length, 0);
  const passed = rows.filter((r) => !r.error && r.issues.failures.length === 0).length;
  const repaired = rows.filter((r) => r.repaired).length;
  lines.push(
    `papers ${rows.length}, passed ${passed}, failures ${failures}, warnings ${warnings}, repaired ${repaired}, ` +
      `tokens in ${usage.input} / out ${usage.output} / cache ${usage.cacheRead}`,
  );
  return lines.join("\n");
}
