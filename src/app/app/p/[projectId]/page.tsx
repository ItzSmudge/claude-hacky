import Link from "next/link";
import { PaperCard } from "@/components/swipe/paper-card";
import { fixturePapers, fixtureProject } from "@/fixtures";

// Placeholder (F-13). Owner: swipe (SW-*). Renders the top fixture card until the deck exists.
export default function DeckPage() {
  const top = fixturePapers[0];
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-3xl text-primary">{fixtureProject.title}</h1>
      <PaperCard {...top} claims={fixtureProject.context.claims} />
      <Link href={`/app/p/${fixtureProject.id}/library`} className="text-primary underline">
        Library
      </Link>
    </div>
  );
}
