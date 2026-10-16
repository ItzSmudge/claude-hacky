import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiError } from "@/lib/api-schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects. Shared by /api/projects/[projectId] and its /context route.

/** Any route under /api/projects/[projectId]. */
export type ProjectRouteContext = { params: Promise<{ projectId: string }> };

export const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

/** The project (as the caller sees it under RLS) and the caller's id, or an error response. */
export async function authorise(ctx: ProjectRouteContext) {
  const { projectId } = await ctx.params;
  if (!z.uuid().safeParse(projectId).success) return { response: error(400, "Invalid project id") };
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { response: error(401, "Sign in to manage projects") };
  const { data: project, error: err } = await supabase
    .from("projects")
    .select("id, owner_id, query")
    .eq("id", projectId)
    .maybeSingle();
  if (err) {
    console.error("[projects] read failed", err.code, err.message);
    return { response: error(500, "Couldn't load the project") };
  }
  if (!project) return { response: error(404, "Project not found") };
  return {
    supabase,
    projectId,
    userId,
    query: project.query,
    isOwner: project.owner_id === userId,
  };
}
