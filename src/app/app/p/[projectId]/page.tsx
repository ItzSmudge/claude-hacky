import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ProjectInvite } from "@/components/group/project-invite";
import { DeckSkeleton } from "@/components/swipe/deck-skeleton";
import { PersistedSwipeDeck } from "@/components/swipe/persisted-swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { extractFeatures, type SwipeSample } from "@/lib/ranking";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SwipeDecision } from "@/types/domain";

// Owner: swipe (SW-*). Papers are fixtures until SW-04 (queue); swipes persist via SW-05;
// earlier swipes seed the ranking (RK-02).
export default function DeckPage({ params }: PageProps<"/app/p/[projectId]">) {
  // Clip the fling at the screen edge (bleeds into main's gutter) without cutting focus rings or shadows.
  return (
    <div className="-mx-4 overflow-x-clip px-4 md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h1 className="min-w-56 flex-1 font-display text-2xl font-semibold text-primary md:text-3xl">
            {fixtureProject.title}
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

async function InviteFor({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  return <ProjectInvite projectId={(await params).projectId} />;
}

async function Deck({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  const { projectId } = await params;
  // Request time: one clock for year features on server (history) and client (deck items).
  await connection();
  const now = new Date().toISOString();
  const history = await swipeHistory(projectId);
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
      items={fixturePapers.filter((item) => !swiped.has(item.paper.id))}
      initialHistory={initialHistory}
      now={now}
      claims={fixtureProject.context.claims}
      libraryHref={`/app/p/${projectId}/library`}
    />
  );
}

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
