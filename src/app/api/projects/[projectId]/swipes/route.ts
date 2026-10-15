import { NextResponse } from "next/server";
import { z } from "zod";
import { swipeRequestSchema, type ApiError } from "@/lib/api-schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: swipe (SW-05). Writes go through the user's own client, so RLS decides membership.

type Ctx = RouteContext<"/api/projects/[projectId]/swipes">;

const projectIdSchema = z.uuid();
const deleteQuerySchema = swipeRequestSchema.pick({ paperId: true });

const error = (status: number, message: string, details?: unknown) =>
  NextResponse.json<ApiError>(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );

/** Resolves the project id and signed-in user, or the error response to return. */
async function authorise(ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!projectIdSchema.safeParse(projectId).success) {
    return { response: error(400, "Invalid project id") } as const;
  }
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { response: error(401, "Sign in to save swipes") } as const;
  return { supabase, projectId, userId } as const;
}

function dbError(op: string, err: { code?: string; message: string }) {
  if (err.code === "42501") return error(403, "You're not a member of this project");
  if (err.code === "23503") return error(404, "Unknown paper");
  console.error(`[swipes] ${op} failed`, err.code, err.message);
  return error(500, "Couldn't save the swipe");
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await authorise(ctx);
  if ("response" in auth) return auth.response;

  const body = swipeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return error(400, "Invalid swipe", z.treeifyError(body.error));

  const { error: err } = await auth.supabase.from("swipes").upsert(
    {
      project_id: auth.projectId,
      paper_id: body.data.paperId,
      user_id: auth.userId,
      decision: body.data.decision,
      created_at: new Date().toISOString(),
    },
    { onConflict: "project_id,paper_id,user_id" },
  );
  if (err) return dbError("upsert", err);
  return new NextResponse(null, { status: 204 });
}

/** Undo: removes the caller's swipe. Deleting nothing is still a success. */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await authorise(ctx);
  if ("response" in auth) return auth.response;

  const query = deleteQuerySchema.safeParse({
    paperId: new URL(request.url).searchParams.get("paperId") ?? undefined,
  });
  if (!query.success) return error(400, "Invalid paper id", z.treeifyError(query.error));

  const { error: err } = await auth.supabase
    .from("swipes")
    .delete()
    .eq("project_id", auth.projectId)
    .eq("paper_id", query.data.paperId)
    .eq("user_id", auth.userId);
  if (err) return dbError("delete", err);
  return new NextResponse(null, { status: 204 });
}
