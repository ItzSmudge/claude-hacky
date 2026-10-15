import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the deck's shape (card + control bar) while it loads. */
export function DeckSkeleton() {
  return (
    <div role="status" aria-label="Loading papers" className="flex flex-col gap-4">
      <Skeleton className="h-112 w-full rounded-2xl" />
      <div className="flex justify-center gap-3">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
    </div>
  );
}
