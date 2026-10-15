import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { DeckSkeleton } from "@/components/swipe/deck-skeleton";
import { PersistedSwipeDeck } from "@/components/swipe/persisted-swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: swipe (SW-*). Papers are fixtures until SW-04 (queue); swipes persist via SW-05.
export default function DeckPage({ params }: PageProps<"/app/p/[projectId]">) {
  // Clip the fling at the screen edge (bleeds into main's gutter) without cutting focus rings or shadows.
  return (
    <div className="-mx-4 overflow-x-clip px-4 md:-mx-8 md:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold text-primary">{fixtureProject.title}</h1>
        <Suspense fallback={<DeckSkeleton />}>
          <Deck params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Deck({ params }: Pick<PageProps<"/app/p/[projectId]">, "params">) {
  const { projectId } = await params;
  const swiped = await swipedPaperIds(projectId);
  return (
    <PersistedSwipeDeck
      key={projectId}
      projectId={projectId}
      items={fixturePapers.filter((item) => !swiped.has(item.paper.id))}
      claims={fixtureProject.context.claims}
      libraryHref={`/app/p/${projectId}/library`}
    />
  );
}

/** Papers the signed-in user already swiped here, so a reload resumes the deck. Empty on any failure. */
async function swipedPaperIds(projectId: string): Promise<Set<string>> {
  if (!z.uuid().safeParse(projectId).success) return new Set();
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from("swipes")
    .select("paper_id")
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) {
    console.error("[deck] reading swipes failed", error.code, error.message);
    return new Set();
  }
  return new Set(data.map((row) => row.paper_id));
}
