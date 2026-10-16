import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ExportPanel } from "@/components/library/export-panel";
import type { LibraryItem } from "@/components/library/library-groups";
import { RelationsPanel } from "@/components/library/relations-panel";
import { SavedPaperList } from "@/components/library/saved-paper-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { computeCredibility } from "@/lib/credibility";
import { citeKeys, loadSavedLibrary, sortByKey } from "@/lib/export";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: library (LB-*). LB-01: saved papers by use / claim; LB-04: how they connect; LB-03: export.
export default function LibraryPage({ params }: PageProps<"/app/p/[projectId]/library">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Suspense fallback={<LibrarySkeleton />}>
        <Library params={params} />
      </Suspense>
    </div>
  );
}

async function Library({ params }: Pick<PageProps<"/app/p/[projectId]/library">, "params">) {
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) notFound();
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const [loaded, { data: auth }] = await Promise.all([
    loadSavedLibrary(supabase, projectId),
    supabase.auth.getClaims(),
  ]);
  const userId = auth?.claims.sub;
  if (!loaded.ok && loaded.reason === "not-found") notFound();

  const heading = (
    <h1 className="font-display text-2xl font-semibold text-primary md:text-3xl">Library</h1>
  );
  if (!loaded.ok) {
    return (
      <>
        {heading}
        <p className="text-muted-foreground">
          Couldn&apos;t load your library. Refresh the page to try again.
        </p>
      </>
    );
  }

  const { title, claims, papers, analyses, savedBy } = loaded.library;
  const keys = citeKeys(papers);
  const sortedKeys = sortByKey(papers, keys).map((p) => keys.get(p.id)!);
  const items: LibraryItem[] = papers.map((paper) => ({
    paper,
    analysis: analyses.get(paper.id),
    credibility: computeCredibility(paper),
    citeKey: keys.get(paper.id)!,
    savedByMe: !!userId && (savedBy.get(paper.id) ?? []).includes(userId),
    savedByTeammate: (savedBy.get(paper.id) ?? []).some((id) => id !== userId),
  }));
  const deckHref = `/app/p/${projectId}`;
  return (
    <>
      <header className="flex flex-col gap-1">
        {heading}
        {/* GR-03 */}
        <Link
          href={`/app/p/${projectId}/group`}
          className="inline-flex min-h-11 items-center self-start rounded text-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
        >
          See what the whole group saved
        </Link>
        <p className="text-muted-foreground">
          {papers.length === 0
            ? title
            : `${papers.length} ${papers.length === 1 ? "paper" : "papers"} saved for ${title}`}
        </p>
      </header>
      {papers.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6">
          <p>Nothing saved yet. Swipe right on papers to collect them here.</p>
          <Button
            asChild
            size="lg"
            className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <Link href={deckHref}>Back to swiping</Link>
          </Button>
        </div>
      ) : (
        <>
          <SavedPaperList projectId={projectId} items={items} claims={claims} />
          {papers.length >= 2 ? (
            <RelationsPanel
              projectId={projectId}
              claims={claims}
              papers={papers.map((p) => ({
                id: p.id,
                title: p.title,
                year: p.year,
                citeKey: keys.get(p.id)!,
              }))}
            />
          ) : null}
          <ExportPanel projectId={projectId} citeKeys={sortedKeys} />
        </>
      )}
    </>
  );
}

function LibrarySkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading your library…</span>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-5 w-72 motion-reduce:animate-none" />
      </div>
      <Skeleton aria-hidden className="h-96 rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}
