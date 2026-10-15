import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { fixturePapers, fixtureProject } from "@/fixtures";

// Owner: swipe (SW-*). Fixture-backed until SW-04 (queue) and SW-05 (persistence) land.
export default function DeckPage() {
  // Clip the fling at the screen edge (bleeds into main's gutter) without cutting focus rings or shadows.
  return (
    <div className="-mx-4 overflow-x-clip px-4 md:-mx-8 md:px-8">
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
