import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Placeholder landing (F-13). MK-02…MK-05 replace this.
export default function LandingPage() {
  return (
    <section className="flex flex-1 flex-col bg-teal-700 px-4 py-6 text-cream-200 md:px-8">
      <Logo className="text-cream-200" />
      <div className="mx-auto flex max-w-3xl flex-1 flex-col items-start justify-center gap-6 py-16">
        <h1 className="text-5xl text-cream-200 md:text-7xl">Swipe right on research.</h1>
        <p className="max-w-[55ch] text-lg text-cream-100">
          Tell PaperCut what you&apos;re writing. Swipe through real papers, see why each one
          matters for your assignment, and leave with a bibliography you can trust.
        </p>
        <Button asChild size="lg" className="bg-cream-200 text-teal-900 hover:bg-cream-100">
          <Link href="/app">Try it — no signup</Link>
        </Button>
      </div>
    </section>
  );
}
