import { NextResponse } from "next/server";
import { z } from "zod";
import { updateProjectRequestSchema, type ApiError, type Project } from "@/lib/api-schemas";
import { PROJECT_COLUMNS, toProject } from "@/components/projects/project-list";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects (PR-02). Writes run as the user, so RLS decides: only owners rename/delete.

type Ctx = RouteContext<"/api/projects/[projectId]">;

const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

/** The project (as the caller sees it under RLS) and the caller's id, or an error response. */
async function authorise(ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!z.uuid().safeParse(projectId).success) return { response: error(400, "Invalid project id") };
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { response: error(401, "Sign in to manage projects") };
  const { data: project, error: err } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (err) {
    console.error("[projects] read failed", err.code, err.message);
    return { response: error(500, "Couldn't load the project") };
  }
  if (!project) return { response: error(404, "Project not found") };
  return { supabase, projectId, userId, isOwner: project.owner_id === userId };
}

/** Rename (or edit query/context). Owner only. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await authorise(ctx);
  if ("response" in auth) return auth.response;
  if (!auth.isOwner) return error(403, "Only the project owner can rename it");

  const body = updateProjectRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error(400, "Invalid project update", z.treeifyError(body.error));
  if (Object.keys(body.data).length === 0) return error(400, "Nothing to update");

  const { data, error: err } = await auth.supabase
    .from("projects")
    .update(body.data)
    .eq("id", auth.projectId)
    .select(PROJECT_COLUMNS)
    .single();
  if (err) {
    console.error("[projects] update failed", err.code, err.message);
    return error(500, "Couldn't rename the project");
  }
  return NextResponse.json<Project>(toProject(data));
}

/** Owners delete the project (cascades to members, swipes, analyses); members leave it. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await authorise(ctx);
  if ("response" in auth) return auth.response;

  const { error: err } = auth.isOwner
    ? await auth.supabase.from("projects").delete().eq("id", auth.projectId)
    : await auth.supabase
        .from("project_members")
        .delete()
        .eq("project_id", auth.projectId)
        .eq("user_id", auth.userId);
  if (err) {
    console.error("[projects] delete failed", err.code, err.message);
    return error(500, auth.isOwner ? "Couldn't delete the project" : "Couldn't leave the project");
  }
  return new NextResponse(null, { status: 204 });
}
