import { NextResponse } from "next/server";
import { z } from "zod";
import { exportRequestSchema, paperSchema, type ApiError } from "@/lib/api-schemas";
import { serverEnv } from "@/lib/env";
import { asciiFold, bibtexFor } from "@/lib/export";
import { notImplemented } from "@/lib/http/not-implemented";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Paper } from "@/types/domain";

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
  if (query.data.format !== "bibtex") return notImplemented("LB-03");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    console.error("[export] reading project failed", projectError.code, projectError.message);
    return error(500, "Couldn't export the library");
  }
  if (!project) return error(404, "Project not found");

  // Saved by any member: the project's shared library.
  const { data: saves, error: savesError } = await supabase
    .from("swipes")
    .select("paper_id, papers(data)")
    .eq("project_id", projectId)
    .eq("decision", "save");
  if (savesError) {
    console.error("[export] reading saves failed", savesError.code, savesError.message);
    return error(500, "Couldn't export the library");
  }

  const papers = new Map<string, Paper>();
  for (const row of saves) {
    const parsed = paperSchema.safeParse(row.papers?.data);
    if (parsed.success) papers.set(parsed.data.id, parsed.data);
    else console.warn("[export] skipping malformed paper", row.paper_id);
  }

  const mailto = serverEnv().CROSSREF_MAILTO;
  const { text } = await bibtexFor([...papers.values()], {
    fetch,
    signal: request.signal,
    userAgent: `PaperCut/1.0${mailto ? ` (mailto:${mailto})` : ""}`,
  });
  return new NextResponse(text, {
    headers: {
      "content-type": "application/x-bibtex; charset=utf-8",
      "content-disposition": `attachment; filename="${fileSlug(project.title)}.bib"`,
      "cache-control": "private, no-store",
    },
  });
}
