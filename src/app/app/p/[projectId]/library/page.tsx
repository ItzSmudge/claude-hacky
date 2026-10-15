import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ExportPanel } from "@/components/library/export-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { citeKeys, loadSavedLibrary, sortByKey } from "@/lib/export";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: library (LB-*). LB-03: export panel; LB-01 adds the saved-paper list above it.
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
  const loaded = await loadSavedLibrary(supabase, projectId);
  if (!loaded.ok && loaded.reason === "not-found") notFound();

  const heading = (
    <h1 className="font-display text-2xl font-semibold text-primary md:text-3xl">Library</h1>
  );
  if (!loaded.ok) {
    return (
      <>
        {heading}
        <p role="alert" className="text-muted-foreground">
          Couldn&apos;t load your library. Refresh the page to try again.
        </p>
      </>
    );
  }

  const { title, papers } = loaded.library;
  const keys = citeKeys(papers);
  const sortedKeys = sortByKey(papers, keys).map((p) => keys.get(p.id)!);
  const deckHref = `/app/p/${projectId}`;
  return (
    <>
      <header className="flex flex-col gap-1">
        {heading}
        <p className="text-muted-foreground">
          {papers.length === 0
            ? title
            : `${papers.length} ${papers.length === 1 ? "paper" : "papers"} saved for ${title}`}
        </p>
      </header>
      {papers.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6">
          <p>Nothing saved yet. Swipe right on papers to collect them here.</p>
          <Button asChild size="lg" className="rounded-xl px-4">
            <Link href={deckHref}>Back to swiping</Link>
          </Button>
        </div>
      ) : (
        <ExportPanel projectId={projectId} citeKeys={sortedKeys} />
      )}
    </>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Loading your library…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
