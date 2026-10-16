import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { z } from "zod";
import { DeckSkeleton } from "@/components/swipe/deck-skeleton";
import { PersistedSwipeDeck } from "@/components/swipe/persisted-swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { projectContextSchema } from "@/lib/api-schemas";
import { extractFeatures, type SwipeSample } from "@/lib/ranking";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SwipeDecision } from "@/types/domain";

// Owner: swipe (SW-*). Papers come from the queue (SW-04), with fixtures as a fallback until
// /api/analyse exists (AI-04); swipes persist via SW-05; earlier swipes seed the ranking (RK-02),
// teammates' too (RK-04).
export const metadata: Metadata = { title: "Deck" };

export default function DeckPage({ params }: PageProps<"/app/p/[projectId]">) {
  // Clip the fling at the screen edge (bleeds into main's gutter) without cutting focus rings or shadows.
  return (
    // Tab switches crossfade (this page enters, the last one exits); router.refresh() and
    // Suspense reveals update in place with no fade (default="none").
    <ViewTransition enter="auto" exit="auto" default="none">
      <div className="-mx-4 overflow-x-clip px-4 md:-mx-8 md:px-8">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <h2 className="sr-only">Deck</h2>
          <Suspense fallback={<DeckSkeleton />}>
            <Deck params={params} />
          </Suspense>
        </div>
      </div>
    </ViewTransition>
  );
}

async function Deck({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  const { projectId } = await params;
  // Request time: one clock for year features on server (history) and client (deck items).
  await connection();
  const now = new Date().toISOString();
  const [{ userId, mine: history, team }, project] = await Promise.all([
    swipeHistory(projectId),
    projectInfo(projectId),
  ]);
  const swiped = new Set(history.map((s) => s.paperId));
  // Features of papers already decided, so a reload resumes the learnt order.
  // TODO(SW-04): look these up in the `papers` cache once the deck isn't fixture-only.
  const featuresOf = (paperId: string) => {
    const entry = fixturePapers.find((item) => item.paper.id === paperId);
    if (!entry) return undefined;
    const features = extractFeatures(entry.paper, {
      credibility: entry.credibility,
      now: new Date(now),
    });
    return features.map((f) => f.id);
  };
  const initialHistory: SwipeSample[] = history.flatMap(({ paperId, decision }) => {
    const features = featuresOf(paperId);
    return features ? [{ features, decision }] : [];
  });
  // RK-04: my decided papers have left the deck, but a teammate's live swipe on one still counts.
  const decidedFeatures = Object.fromEntries(
    [...swiped].flatMap((id) => {
      const features = featuresOf(id);
      return features ? [[id, features]] : [];
    }),
  );
  return (
    <PersistedSwipeDeck
      key={projectId}
      projectId={projectId}
      query={project.query}
      swipedIds={[...swiped]}
      fallbackItems={fixturePapers.filter((item) => !swiped.has(item.paper.id))}
      initialHistory={initialHistory}
      userId={userId}
      initialTeam={team}
      decidedFeatures={decidedFeatures}
      now={now}
      claims={project.claims}
      libraryHref={`/app/p/${projectId}/library`}
    />
  );
}

/**
 * The project's search query and claims (from its parsed brief), read as the user. The demo's
 * values only stand in when the row can't be read; a project with no brief simply has no claims.
 */
async function projectInfo(
  projectId: string,
): Promise<{ query: string; claims: typeof fixtureProject.context.claims }> {
  const demo = {
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
    query: data.query?.trim() || data.title,
    claims: projectContextSchema.safeParse(data.context).data?.claims ?? [],
  };
}

type SwipeRow = { userId: string; paperId: string; decision: SwipeDecision };

/**
 * Everyone's swipes here, oldest first: mine resume the deck, teammates' rank it too (RK-04).
 * Empty on any failure.
 */
async function swipeHistory(
  projectId: string,
): Promise<{ userId?: string; mine: Omit<SwipeRow, "userId">[]; team: SwipeRow[] }> {
  const none = { mine: [], team: [] };
  if (!z.uuid().safeParse(projectId).success) return none;
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return none;
  const { data, error } = await supabase
    .from("swipes")
    .select("paper_id, user_id, decision")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[deck] reading swipes failed", error.code, error.message);
    return { userId, ...none };
  }
  const rows: SwipeRow[] = data.flatMap((row) =>
    row.decision === "save" || row.decision === "skip"
      ? [{ userId: row.user_id, paperId: row.paper_id, decision: row.decision }]
      : [],
  );
  return {
    userId,
    mine: rows
      .filter((r) => r.userId === userId)
      .map(({ paperId, decision }) => ({ paperId, decision })),
    team: rows.filter((r) => r.userId !== userId),
  };
}
