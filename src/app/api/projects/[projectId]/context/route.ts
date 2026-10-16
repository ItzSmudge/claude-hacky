import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE } from "@/components/projects/new-project";
import { parseBrief } from "@/lib/ai";
import { resolveBriefKind, type BriefKind } from "@/lib/ai/brief-input";
import { BriefInputError } from "@/lib/ai/errors";
import type { ProjectContext } from "@/types/domain";
import { authorise, error } from "../authorise";
import { briefStoragePath, contextErrorStatus } from "./brief-storage";

// Owner: projects (PR-01). POST multipart { brief? } → { context }. The context is NOT saved here:
// the review step PATCHes the approved version, so cards never use claims nobody approved.

/** parseBrief on the SMART model can take a while on a long PDF (plus one repair). */
export const maxDuration = 120;
const PARSE_TIMEOUT_MS = 110_000;

const CONTENT_TYPE: Record<BriefKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  text: "text/plain",
};

/** Markdown keeps its own type; browsers often send octet-stream for `.md`. */
const contentTypeOf = (kind: BriefKind, filename: string) =>
  kind === "text" && /\.(md|markdown)$/i.test(filename) ? "text/markdown" : CONTENT_TYPE[kind];

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[projectId]/context">,
): Promise<Response> {
  const auth = await authorise(ctx);
  if (auth.response) return auth.response;
  if (!auth.isOwner) return error(403, "Only the project owner can set up the brief");
  const { supabase, projectId, query } = auth;

  const form = await request.formData().catch(() => null);
  if (!form) return error(400, "Send the brief as a form upload");
  const entry = form.get("brief");
  // An empty file input still submits a nameless, zero-byte File: that means "no brief".
  const file = entry instanceof File && entry.size > 0 ? entry : null;

  let upload: { path: string; data: Uint8Array; mimeType: string } | null = null;
  if (file) {
    if (file.size > MAX_UPLOAD_BYTES) return error(400, TOO_LARGE_MESSAGE);
    let mimeType: string;
    try {
      mimeType = contentTypeOf(
        resolveBriefKind({ mimeType: file.type, filename: file.name }),
        file.name,
      );
    } catch (err) {
      if (err instanceof BriefInputError) return error(400, err.message);
      throw err;
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const path = briefStoragePath(projectId, file.name, crypto.randomUUID());
    const { error: uploadError } = await supabase.storage
      .from("briefs")
      .upload(path, data, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error("[projects] brief upload failed", uploadError.message);
      return error(500, "Couldn't save your brief");
    }
    upload = { path, data, mimeType };
  }

  let parsed: Awaited<ReturnType<typeof parseBrief>>;
  try {
    parsed = await parseBrief({
      query,
      brief:
        upload && file
          ? { data: upload.data, mimeType: upload.mimeType, filename: file.name }
          : undefined,
      signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    });
  } catch (err) {
    if (upload)
      await supabase.storage
        .from("briefs")
        .remove([upload.path])
        .catch(() => undefined);
    // Class name only: never log the student's brief text.
    console.error("[projects] brief parse failed", err instanceof Error ? err.name : typeof err);
    const { status, message } = contextErrorStatus(err);
    return error(status, message);
  }

  if (upload && file) {
    const { error: docError } = await supabase.from("project_documents").insert({
      project_id: projectId,
      storage_path: upload.path,
      filename: file.name,
      extracted_text: parsed.extractedText,
    });
    if (docError)
      console.error("[projects] document insert failed", docError.code, docError.message);
  }

  return NextResponse.json<{ context: ProjectContext }>({ context: parsed.context });
}
