import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/api-schemas";
import { notImplemented } from "@/lib/http/not-implemented";
import { loadProjects, type ProjectListItem } from "@/components/projects/project-list";
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

export async function POST(_request: Request) {
  return notImplemented("PR-01");
}
