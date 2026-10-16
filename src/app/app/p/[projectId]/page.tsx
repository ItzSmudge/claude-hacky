import { connection } from "next/server";
import { cache, Suspense } from "react";
import { z } from "zod";
import { ProjectInvite } from "@/components/group/project-invite";
import { DeckSkeleton } from "@/components/swipe/deck-skeleton";
import { PersistedSwipeDeck } from "@/components/swipe/persisted-swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { projectContextSchema } from "@/lib/api-schemas";
import { extractFeatures, type SwipeSample } from "@/lib/ranking";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SwipeDecision } from "@/types/domain";

// Owner: swipe (SW-*). Papers come from the queue (SW-04), with fixtures as a fallback until
// /api/analyse exists (AI-04); swipes persist via SW-05; earlier swipes seed the ranking (RK-02).
export default function DeckPage({ params }: PageProps<"/app/p/[projectId]">) {
  // Clip the fling at the screen edge (bleeds into main's gutter) without cutting focus rings or shadows.
  return (
    <div className="-mx-4 overflow-x-clip px-4 md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-56 flex-1 font-display text-2xl font-semibold text-balance break-words text-primary md:text-3xl">
            <Suspense fallback={<span className="text-muted-foreground">Loading project…</span>}>
              <Title params={params} />
            </Suspense>
          </h1>
          {/* GR-01: share the join code / link */}
          <Suspense fallback={<div aria-hidden className="h-11 w-24 shrink-0" />}>
            <InviteFor params={params} />
          </Suspense>
        </div>
        <Suspense fallback={<DeckSkeleton />}>
          <Deck params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Title({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  return (await projectInfo((await params).projectId)).title;
}

async function InviteFor({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  return <ProjectInvite projectId={(await params).projectId} />;
}

async function Deck({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  const { projectId } = await params;
  // Request time: one clock for year features on server (history) and client (deck items).
  await connection();
  const now = new Date().toISOString();
  const [history, project] = await Promise.all([swipeHistory(projectId), projectInfo(projectId)]);
  const swiped = new Set(history.map((s) => s.paperId));
  // Features of papers already decided, so a reload resumes the learnt order.
  // TODO(SW-04): look these up in the `papers` cache once the deck isn't fixture-only.
  const initialHistory: SwipeSample[] = history.flatMap(({ paperId, decision }) => {
    const entry = fixturePapers.find((item) => item.paper.id === paperId);
    if (!entry) return [];
    const features = extractFeatures(entry.paper, {
      credibility: entry.credibility,
      now: new Date(now),
    });
    return [{ features: features.map((f) => f.id), decision }];
  });
  return (
    <PersistedSwipeDeck
      key={projectId}
      projectId={projectId}
      query={project.query}
      swipedIds={[...swiped]}
      fallbackItems={fixturePapers.filter((item) => !swiped.has(item.paper.id))}
      initialHistory={initialHistory}
      now={now}
      claims={project.claims}
      libraryHref={`/app/p/${projectId}/library`}
    />
  );
}

/**
 * The project's own title, search query and claims (from its parsed brief), read as the user.
 * Cached per request, so the heading and the deck share one query. The demo's values only stand
 * in when the row can't be read; a project with no brief simply has no claims.
 */
const projectInfo = cache(
  async (
    projectId: string,
  ): Promise<{ title: string; query: string; claims: typeof fixtureProject.context.claims }> => {
    const demo = {
      title: fixtureProject.title,
      query: fixtureProject.query,
      claims: fixtureProject.context.claims,
    };
    if (!z.uuid().safeParse(projectId).success) return demo;
    // Request time only: supabase-js reads the clock to check token expiry.
    await connection();
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("projects")
      .select("title, query, context")
      .eq("id", projectId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("[deck] reading project failed", error.code, error.message);
      return demo;
    }
    return {
      title: data.title,
      query: data.query?.trim() || data.title,
      claims: projectContextSchema.safeParse(data.context).data?.claims ?? [],
    };
  },
);

/** The signed-in user's swipes here, oldest first, so a reload resumes the deck. Empty on any failure. */
async function swipeHistory(
  projectId: string,
): Promise<{ paperId: string; decision: SwipeDecision }[]> {
  if (!z.uuid().safeParse(projectId).success) return [];
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return [];
  const { data, error } = await supabase
    .from("swipes")
    .select("paper_id, decision")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[deck] reading swipes failed", error.code, error.message);
    return [];
  }
  return data.flatMap((row) =>
    row.decision === "save" || row.decision === "skip"
      ? [{ paperId: row.paper_id, decision: row.decision }]
      : [],
  );
}
