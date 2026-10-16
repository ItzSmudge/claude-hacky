import { NextResponse } from "next/server";
import { z } from "zod";
import { createProjectRequestSchema, type ApiError, type Project } from "@/lib/api-schemas";
import {
  loadProjects,
  PROJECT_COLUMNS,
  toProject,
  type ProjectListItem,
} from "@/components/projects/project-list";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects (PR-01, PR-02)

/** The caller's projects (owned or joined), newest first, with saved/swiped counts. */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId)
    return NextResponse.json<ApiError>({ error: "Sign in to see projects" }, { status: 401 });

  const projects = await loadProjects(supabase, userId);
  if (!projects) {
    return NextResponse.json<ApiError>({ error: "Couldn't load your projects" }, { status: 500 });
  }
  return NextResponse.json<{ projects: ProjectListItem[] }>({ projects });
}

/** Creates a project owned by the caller (RLS; owner membership and join code come from the DB). */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub)
    return NextResponse.json<ApiError>({ error: "Sign in to start a project" }, { status: 401 });

  const body = createProjectRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json<ApiError>(
      { error: "Invalid project", details: z.treeifyError(body.error) },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(body.data)
    .select(PROJECT_COLUMNS)
    .single();
  if (error) {
    console.error("[projects] insert failed", error.code, error.message);
    return NextResponse.json<ApiError>({ error: "Couldn't create the project" }, { status: 500 });
  }
  return NextResponse.json<Project>(toProject(data), { status: 201 });
}
