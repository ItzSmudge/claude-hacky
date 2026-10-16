import { NextResponse } from "next/server";
import { z } from "zod";
import { analyseRelations } from "@/lib/ai";
import type { ProjectRelations } from "@/lib/ai/schemas";
import { projectContextSchema, type ApiError } from "@/lib/api-schemas";
import { loadSavedLibrary } from "@/lib/export";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: ai (AI-05). POST { projectId } → { relations: ProjectRelations } over the saved set.
// Nothing is stored: LB-04 asks again when the student wants a fresh view.

/** Vercel function limit; the model call is aborted before it so the caller gets an error. */
export const maxDuration = 60;
const DEADLINE_MS = 55_000;

const requestSchema = z.object({ projectId: z.uuid() });

const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

export async function POST(request: Request) {
  // Members only: every call can spend model tokens.
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Sign in to see how your papers connect");

  const body: unknown = await request.json().catch(() => undefined);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return error(400, "Invalid request", z.treeifyError(parsed.error));
  const { projectId } = parsed.data;

  // RLS as the user: "not-found" covers projects they aren't a member of.
  const loaded = await loadSavedLibrary(supabase, projectId);
  if (!loaded.ok)
    return loaded.reason === "not-found"
      ? error(404, "Project not found")
      : error(500, "Couldn't load your library");
  const { title, claims, papers, analyses } = loaded.library;
  // The parsed brief's topic says more than the name the student typed; fall back to that name.
  const { data: project } = await supabase
    .from("projects")
    .select("context")
    .eq("id", projectId)
    .maybeSingle();
  const topic = projectContextSchema.safeParse(project?.context).data?.topic || title;

  try {
    const relations = await analyseRelations({
      projectId,
      topic,
      claims,
      papers,
      analyses,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]),
    });
    return NextResponse.json<{ relations: ProjectRelations }>(
      { relations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Class name only: the error may quote paper text.
    console.error("[relations] analysis failed", err instanceof Error ? err.name : typeof err);
    return error(502, "Couldn't analyse relations");
  }
}
