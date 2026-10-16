import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, ViewTransition } from "react";
import { z } from "zod";
import { GroupMembers } from "@/components/group/group-members";
import { GroupReadingList } from "@/components/group/group-reading-list";
import { memberLabels } from "@/components/group/group-list";
import { loadGroup } from "@/components/group/load-group";
import { formatMeta } from "@/components/swipe/card-format";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Group reading list" };

// Owner: group (GR-03). Every member's saves in one list, with the papers the group disagrees on.
export default function GroupPage({ params }: PageProps<"/app/p/[projectId]/group">) {
  return (
    // Tab switches crossfade (this page enters, the last one exits); router.refresh() and
    // Suspense reveals update in place with no fade (default="none").
    <ViewTransition enter="auto" exit="auto" default="none">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Suspense fallback={<GroupSkeleton />}>
          <Group params={params} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

async function Group({ params }: Pick<PageProps<"/app/p/[projectId]/group">, "params">) {
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) notFound();
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const [loaded, { data: auth }] = await Promise.all([
    loadGroup(supabase, projectId),
    supabase.auth.getClaims(),
  ]);
  if (!loaded.ok && loaded.reason === "not-found") notFound();
  const me = auth?.claims.sub;

  const heading = <h2 className="sr-only">Group reading list</h2>;
  if (!loaded.ok) {
    return (
      <>
        {heading}
        <p className="text-muted-foreground">
          Couldn&apos;t load the group&apos;s list. Refresh the page to try again.
        </p>
      </>
    );
  }
  const { members, votes, papers, whyItMatters } = loaded.group;
  const views = [...papers.values()].map((paper) => {
    const meta = formatMeta(paper);
    return {
      id: paper.id,
      title: paper.title,
      meta: `${meta.author} · ${meta.venue} · ${meta.year}`,
      whyItMatters: whyItMatters.get(paper.id),
    };
  });
  return (
    <>
      {heading}
      <GroupMembers
        projectId={projectId}
        me={me}
        members={members.map((m, i) => ({
          userId: m.userId,
          name: m.displayName?.trim() || `Member ${i + 1}`,
          role: m.role,
        }))}
      />
      <GroupReadingList
        projectId={projectId}
        me={me}
        memberCount={Math.max(1, members.length)}
        labels={[...memberLabels(members, me)]}
        papers={views}
        initialVotes={votes}
      />
    </>
  );
}

function GroupSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading the group&apos;s list…</span>
      <Skeleton aria-hidden className="h-64 rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}
