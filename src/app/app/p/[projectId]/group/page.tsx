import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { GroupReadingList } from "@/components/group/group-reading-list";
import { memberLabels } from "@/components/group/group-list";
import { loadGroup } from "@/components/group/load-group";
import { formatMeta } from "@/components/swipe/card-format";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Group reading list" };

const LINK =
  "rounded font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden";

// Owner: group (GR-03). Every member's saves in one list, with the papers the group disagrees on.
export default function GroupPage({ params }: PageProps<"/app/p/[projectId]/group">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Suspense fallback={<GroupSkeleton />}>
        <Group params={params} />
      </Suspense>
    </div>
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

  const heading = (
    <h1 className="font-display text-2xl font-semibold text-primary md:text-3xl">
      Group reading list
    </h1>
  );
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
  const { title, members, votes, papers, whyItMatters } = loaded.group;
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
      <header className="flex flex-col gap-1">
        {heading}
        <p className="text-muted-foreground">{title}</p>
        <nav aria-label="This project" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/app/p/${projectId}`} className={LINK}>
            Back to swiping
          </Link>
          <Link href={`/app/p/${projectId}/library`} className={LINK}>
            Your library
          </Link>
        </nav>
      </header>
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
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 motion-reduce:animate-none" />
        <Skeleton className="h-5 w-72 motion-reduce:animate-none" />
      </div>
      <Skeleton aria-hidden className="h-64 rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}
