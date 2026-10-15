import { NextResponse } from "next/server";
import { z } from "zod";
import { exportRequestSchema, type ApiError } from "@/lib/api-schemas";
import { serverEnv } from "@/lib/env";
import {
  asciiFold,
  bibtexFor,
  citeKeys,
  csvExport,
  latexBibliography,
  loadSavedLibrary,
  markdownReadingList,
} from "@/lib/export";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: export (LB-02 bibtex; LB-03 latex, csv, markdown). Reads go through the user's own
// client, so RLS limits the export to projects the caller is a member of.

const projectIdSchema = z.uuid();

const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

/** "Social media & teens!" → "social-media-teens" (ASCII, for Content-Disposition). */
const fileSlug = (title: string) =>
  asciiFold(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "") || "references";

export async function GET(request: Request, ctx: RouteContext<"/api/export/[projectId]">) {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Sign in to export");

  const { projectId } = await ctx.params;
  if (!projectIdSchema.safeParse(projectId).success) return error(400, "Invalid project id");
  const query = exportRequestSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return error(400, "Invalid export format", z.treeifyError(query.error));

  const loaded = await loadSavedLibrary(supabase, projectId);
  if (!loaded.ok) {
    return loaded.reason === "not-found"
      ? error(404, "Project not found")
      : error(500, "Couldn't export the library");
  }
  const { title, papers, analyses } = loaded.library;
  const keys = citeKeys(papers);

  let file: { body: string; ext: string; type: string };
  switch (query.data.format) {
    case "bibtex": {
      const mailto = serverEnv().CROSSREF_MAILTO;
      const { text } = await bibtexFor(papers, {
        fetch,
        signal: request.signal,
        userAgent: `PaperCut/1.0${mailto ? ` (mailto:${mailto})` : ""}`,
      });
      file = { body: text, ext: "bib", type: "application/x-bibtex; charset=utf-8" };
      break;
    }
    case "latex":
      file = {
        body: latexBibliography(papers, keys),
        ext: "tex",
        type: "application/x-tex; charset=utf-8",
      };
      break;
    case "csv":
      file = {
        body: csvExport(papers, keys, analyses),
        ext: "csv",
        type: "text/csv; charset=utf-8",
      };
      break;
    case "markdown":
      file = {
        body: markdownReadingList(title, papers, keys, analyses),
        ext: "md",
        type: "text/markdown; charset=utf-8",
      };
      break;
  }
  return new NextResponse(file.body, {
    headers: {
      "content-type": file.type,
      "content-disposition": `attachment; filename="${fileSlug(title)}.${file.ext}"`,
      "cache-control": "private, no-store",
    },
  });
}
