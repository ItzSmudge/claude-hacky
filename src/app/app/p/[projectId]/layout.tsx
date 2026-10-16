import { connection } from "next/server";
import { cache, Suspense } from "react";
import { z } from "zod";
import { ProjectInvite } from "@/components/group/project-invite";
import { countSaved } from "@/components/projects/saved-count";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { fixtureProject } from "@/fixtures";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects (PR-04). One header for the deck, library and group pages: the project's title,
// who's here + invite (GR-01/02), and tabs between the three.
export default function ProjectLayout({ children, params }: LayoutProps<"/app/p/[projectId]">) {
  return (
    <div className="flex flex-col gap-6">
      <header className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-0 flex-1 basis-56 font-display text-2xl font-semibold text-balance break-words text-primary md:text-3xl">
            <Suspense fallback={<span className="text-muted-foreground">Loading project…</span>}>
              <Title params={params} />
            </Suspense>
          </h1>
          <Suspense fallback={<div aria-hidden className="h-11 w-24 shrink-0" />}>
            <InviteFor params={params} />
          </Suspense>
        </div>
        <Suspense fallback={<div aria-hidden className="h-11 border-b border-border" />}>
          <Tabs params={params} />
        </Suspense>
      </header>
      {/* Each page wraps itself in a <ViewTransition>, so tab switches crossfade (not refreshes). */}
      {children}
    </div>
  );
}

type Params = Pick<LayoutProps<"/app/p/[projectId]">, "params">;

async function Title({ params }: Params) {
  return (await header((await params).projectId)).title;
}

async function InviteFor({ params }: Params) {
  return <ProjectInvite projectId={(await params).projectId} />;
}

async function Tabs({ params }: Params) {
  const { projectId } = await params;
  return <ProjectTabs projectId={projectId} initialSaved={(await header(projectId)).saved} />;
}

/**
 * The project's title and how many papers the group has saved, read as the user. A non-uuid id is
 * the deck's fixture demo, so it gets the demo's title; a real id we can't read (missing, not a
 * member) says so instead of borrowing the demo's name above a not-found page.
 */
const header = cache(async (projectId: string): Promise<{ title: string; saved: number }> => {
  const demo = { title: fixtureProject.title, saved: 0 };
  if (!z.uuid().safeParse(projectId).success) return demo;
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const [project, saves] = await Promise.all([
    supabase.from("projects").select("title").eq("id", projectId).maybeSingle(),
    supabase.from("swipes").select("paper_id").eq("project_id", projectId).eq("decision", "save"),
  ]);
  if (project.error) console.error("[project] reading title failed", project.error.message);
  if (saves.error) console.error("[project] counting saves failed", saves.error.message);
  return { title: project.data?.title ?? "Project not found", saved: countSaved(saves.data) };
});
