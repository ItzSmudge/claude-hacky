import type { ProjectContext } from "@/types/domain";

/**
 * PR-01: pure helpers for the new project flow, shared by the /app card (client) and the
 * context route (server). No server-only imports here.
 */

/** Vercel rejects function bodies over ~4.5 MB, so this, not the 10 MB bucket, is the limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_BRIEF = ".pdf,.docx,.txt,.md";
export const MAX_CLAIMS = 6;
export const TOO_LARGE_MESSAGE = "Briefs can be up to 4 MB. Try the Word or text version.";
const UNSUPPORTED_MESSAGE = "Upload a PDF, Word (.docx) or text file.";

const MAX_TITLE = 80;
const EXTENSIONS = new Set(ACCEPTED_BRIEF.split(",").map((ext) => ext.slice(1)));

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/** The project title until the brief's topic replaces it: the question, cut at a word. */
export function titleFromQuestion(question: string): string {
  const text = tidy(question);
  if (text.length <= MAX_TITLE) return text;
  const cut = text.slice(0, MAX_TITLE - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The browser-side check before upload: an error message to show, or null if the file is fine. */
export function checkBriefFile(file: { name: string; size: number }): string | null {
  const extension = /\.([a-z0-9]+)$/.exec(file.name.toLowerCase())?.[1];
  if (!extension || !EXTENSIONS.has(extension)) return UNSUPPORTED_MESSAGE;
  if (file.size > MAX_UPLOAD_BYTES) return TOO_LARGE_MESSAGE;
  return null;
}

/** What the review step edits: claims as plain text, ids are assigned on save. */
export interface ReviewDraft {
  topic: string;
  summary: string;
  claims: string[];
  themes: string[];
  constraints: string[];
}

export function draftFromContext(context: ProjectContext): ReviewDraft {
  return {
    topic: context.topic,
    summary: context.summary,
    claims: context.claims.map((claim) => claim.text),
    themes: [...context.themes],
    constraints: [...context.constraints],
  };
}

const kept = (items: string[]) => items.map(tidy).filter(Boolean);

/** The approved context: empties dropped, at most MAX_CLAIMS claims, ids c1…cn in shown order. */
export function contextFromDraft(draft: ReviewDraft): ProjectContext {
  return {
    topic: tidy(draft.topic),
    summary: draft.summary.trim(),
    claims: kept(draft.claims)
      .slice(0, MAX_CLAIMS)
      .map((text, i) => ({ id: `c${i + 1}`, text })),
    themes: kept(draft.themes),
    constraints: kept(draft.constraints),
  };
}

/** 400 means the file (or question) was the problem; anything else is the AI or the server. */
export function failureKind(status: number): "file" | "ai" {
  return status === 400 ? "file" : "ai";
}
