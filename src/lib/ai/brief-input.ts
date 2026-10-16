import "server-only";

import mammoth from "mammoth";
import { BriefInputError } from "./errors";

/**
 * AI-02: uploaded brief bytes → what the model is sent. PDFs go as a native document block;
 * DOCX (via mammoth) and text go as capped text. No network, so it's tested with real files.
 */

export interface BriefFile {
  data: Uint8Array;
  mimeType: string;
  filename: string;
}

export type BriefKind = "pdf" | "docx" | "text";

export type BriefContent =
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "empty" };

/** The `briefs` storage bucket's limit. */
export const MAX_BRIEF_BYTES = 10 * 1024 * 1024;
/** Text sent to the model; a long brief is cut and the prompt says so. */
export const MAX_BRIEF_CHARS = 60_000;

const BY_MIME: Record<string, BriefKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "text",
};
const BY_EXTENSION: Record<string, BriefKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "text",
  md: "text",
  markdown: "text",
};

/** MIME type first (ignoring parameters and case), then the extension: browsers often send octet-stream. */
export function resolveBriefKind({
  mimeType,
  filename,
}: Pick<BriefFile, "mimeType" | "filename">): BriefKind {
  const mime = mimeType.split(";")[0]!.trim().toLowerCase();
  const extension = /\.([a-z0-9]+)$/.exec(filename.toLowerCase())?.[1];
  const kind = BY_MIME[mime] ?? (extension ? BY_EXTENSION[extension] : undefined);
  if (!kind) {
    throw new BriefInputError(
      "unsupported",
      `Upload a PDF, Word (.docx) or text file — "${filename}" isn't one.`,
    );
  }
  return kind;
}

const PDF_HEADER = "%PDF-";

async function docxText({ data, filename }: BriefFile): Promise<string> {
  try {
    return (await mammoth.extractRawText({ buffer: Buffer.from(data) })).value;
  } catch {
    throw new BriefInputError("unreadable", `Couldn't read "${filename}" as a Word document.`);
  }
}

/**
 * Throws BriefInputError for files that are too large, unsupported or unreadable. An empty file
 * is not an error: the context then comes from the question alone. `extractedText` (for
 * `project_documents`) is the full text, `null` for PDFs.
 */
export async function readBrief(
  file: BriefFile,
): Promise<{ content: BriefContent; extractedText: string | null }> {
  if (file.data.byteLength > MAX_BRIEF_BYTES) {
    throw new BriefInputError("too-large", "Briefs can be up to 10 MB.");
  }
  const kind = resolveBriefKind(file);
  if (file.data.byteLength === 0) {
    return { content: { kind: "empty" }, extractedText: kind === "pdf" ? null : "" };
  }

  if (kind === "pdf") {
    const header = new TextDecoder().decode(file.data.subarray(0, PDF_HEADER.length));
    if (header !== PDF_HEADER) {
      throw new BriefInputError("unreadable", `"${file.filename}" isn't a readable PDF.`);
    }
    return {
      content: { kind: "pdf", base64: Buffer.from(file.data).toString("base64") },
      extractedText: null,
    };
  }

  // TextDecoder drops a UTF-8 BOM by default.
  const raw = kind === "docx" ? await docxText(file) : new TextDecoder("utf-8").decode(file.data);
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { content: { kind: "empty" }, extractedText: "" };

  const truncated = text.length > MAX_BRIEF_CHARS;
  return {
    content: { kind: "text", text: truncated ? text.slice(0, MAX_BRIEF_CHARS) : text, truncated },
    extractedText: text,
  };
}
