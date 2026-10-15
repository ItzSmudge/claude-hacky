import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";

// Owner: swipe (SW-*). Fixture-backed until SW-04 (queue) and SW-05 (persistence) land.
export default function DeckPage() {
  return (
    <div className="overflow-x-clip">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold text-primary">{fixtureProject.title}</h1>
        <SwipeDeck
          items={fixturePapers}
          claims={fixtureProject.context.claims}
          libraryHref={`/app/p/${fixtureProject.id}/library`}
        />
      </div>
    </div>
  );
}
