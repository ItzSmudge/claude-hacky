import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the deck's shape (card + control bar) while it loads. */
export function DeckSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading papers…</span>
      <Skeleton className="h-112 w-full rounded-2xl motion-reduce:animate-none" />
      <div className="flex justify-center gap-3">
        <Skeleton className="h-11 w-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-11 w-24 rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-11 w-24 rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** Just the card, for inside the deck, which already has its own button bar. */
export function CardSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Analysing the next paper…</span>
      <Skeleton className="h-112 w-full rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}
