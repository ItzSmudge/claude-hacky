import {
  Accessibility,
  ArrowDown,
  BadgeCheck,
  Bot,
  Database,
  Download,
  FileText,
  Layers,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { DemoCardStack, type DemoCard } from "@/components/marketing/demo-card-stack";
import { formatMeta } from "@/components/swipe/card-format";
import { Button } from "@/components/ui/button";
import { fixturePapers } from "@/fixtures";

// Owner: marketing (MK-02…MK-05). Static: no auth or session work on this page.

export const metadata: Metadata = {
  openGraph: {
    type: "website",
    siteName: "PaperCut",
    locale: "en_GB",
    title: "PaperCut — swipe right on research",
    description:
      "Swipe through real papers, see why each one matters for your assignment, and leave with a bibliography you can trust.",
  },
  twitter: { card: "summary_large_image" },
};

const DEMO_CARDS: DemoCard[] = fixturePapers.slice(0, 6).map(({ paper, analysis, credibility }) => {
  const meta = formatMeta(paper);
  return {
    id: paper.id,
    title: paper.title,
    meta: `${meta.venue} · ${meta.year}`,
    score: credibility.score,
    whyItMatters: analysis.whyItMatters,
  };
});

/** Cream-on-teal focus ring for controls on the teal bands. */
const ON_TEAL_FOCUS =
  "focus-visible:ring-2 focus-visible:ring-cream-200 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700 focus-visible:outline-none";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: FileText,
    title: "Tell it what you're writing",
    body: "Type your research question or upload the coursework brief. PaperCut picks out the claims you need to test.",
  },
  {
    icon: Layers,
    title: "Swipe through real papers",
    body: "Right to save, left to skip. Each card says in one line why that paper matters for your brief, and whether it supports or challenges each claim.",
  },
  {
    icon: Download,
    title: "Export your bibliography",
    body: "Your library is grouped by how you'll use each paper. Download BibTeX, LaTeX, CSV or a reading list, or copy every \\cite{} at once.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string; soon?: boolean }[] = [
  {
    icon: Target,
    title: "Brief-aware",
    body: "Relevance and stance are judged against your assignment, not a generic search ranking.",
  },
  {
    icon: BadgeCheck,
    title: "Real citations",
    body: "Every paper comes from a scholarly database, with a credibility score you can inspect.",
  },
  {
    icon: Users,
    title: "Group mode",
    body: "Swipe with your study group, see the compiled reading list and where you disagree.",
    soon: true,
  },
  {
    icon: Accessibility,
    title: "Accessible",
    body: "Works with keyboard and screen readers, respects reduced motion, and has a high-contrast mode.",
  },
];

const FROM_SOURCE = [
  "Titles, authors, years and venues",
  "DOIs and links",
  "BibTeX (from doi.org, or built by code)",
  "Credibility, computed from citations, peer review, venue and recency",
];
const FROM_CLAUDE = [
  "A short overview of the abstract it was given",
  "One line on why the paper matters for your brief",
  "Whether it supports or challenges each of your claims",
];

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Trust />
      <ClosingCta />
      <footer className="border-t border-border bg-background px-4 py-8 text-sm text-muted-foreground md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>Real papers, honest summaries, citations you can trust.</p>
        </div>
      </footer>
    </>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-teal-700 px-4 pt-6 pb-16 text-cream-200 md:px-8 md:pb-24"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Logo className={`text-cream-200 ${ON_TEAL_FOCUS}`} />
        <Link
          href="/app"
          className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-cream-100 underline-offset-4 hover:underline ${ON_TEAL_FOCUS}`}
        >
          Open the app
        </Link>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl items-center gap-12 md:mt-20 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col items-start gap-6">
          <h1
            id="hero-title"
            className="font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-cream-200 md:text-7xl"
          >
            Swipe right on research.
          </h1>
          <p className="max-w-[55ch] text-lg leading-relaxed text-cream-100">
            Tell PaperCut what you&apos;re writing. Swipe through real papers, see in one line why
            each one matters for your assignment, and leave with a bibliography you can trust.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className={`h-12 rounded-xl bg-cream-200 px-6 text-base text-teal-900 hover:bg-cream-100 ${ON_TEAL_FOCUS}`}
            >
              <Link href="/app">Try it — no signup</Link>
            </Button>
            <a
              href="#how-it-works"
              className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-cream-100 underline-offset-4 hover:underline ${ON_TEAL_FOCUS}`}
            >
              How it works
              <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden />
            </a>
          </div>
        </div>
        <DemoCardStack cards={DEMO_CARDS} />
      </div>
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="font-display text-3xl font-semibold text-balance text-primary md:text-4xl"
      >
        {children}
      </h2>
    </div>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="scroll-mt-4 bg-background px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <SectionHeading id="how-title" eyebrow="How it works">
          From brief to bibliography in three steps
        </SectionHeading>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6 hc:border-2"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="font-display text-xl font-semibold text-primary">
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className="leading-relaxed text-card-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      aria-labelledby="features-title"
      className="bg-secondary px-4 py-16 text-secondary-foreground md:px-8 md:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <SectionHeading id="features-title" eyebrow="Why PaperCut">
          Built for the essay you&apos;re actually writing
        </SectionHeading>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, soon }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper hc:border-2"
            >
              <Icon className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-primary">
                {title}
                {soon && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-sans text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </h3>
              <p className="text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section
      aria-labelledby="trust-title"
      className="bg-teal-700 px-4 py-16 text-cream-100 md:px-8 md:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium tracking-wide text-cream-300 uppercase">
            Retrieval only
          </p>
          <h2
            id="trust-title"
            className="font-display text-4xl font-semibold text-balance text-cream-200 md:text-5xl"
          >
            Every citation is real.
          </h2>
          <p className="max-w-[55ch] text-lg leading-relaxed">
            AI tools that write references from memory invent papers that don&apos;t exist. PaperCut
            never lets it: papers come from OpenAlex, an open index of hundreds of millions of
            scholarly works. Claude only reads what we retrieved and explains it.
          </p>
          <p className="max-w-[55ch] leading-relaxed">
            Claude refers to papers by our internal id, never by title or author. Any reference it
            makes to a paper we didn&apos;t retrieve is thrown away before you see it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TrustList icon={Database} title="Comes from the source" items={FROM_SOURCE} />
          <TrustList icon={Bot} title="What Claude writes" items={FROM_CLAUDE} />
        </div>
      </div>
    </section>
  );
}

function TrustList({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-teal-600 bg-teal-800 p-5 md:p-6 hc:border-2 hc:border-cream-200">
      <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-cream-200">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-relaxed">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-cream-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="bg-background px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h2
          id="cta-title"
          className="font-display text-3xl font-semibold text-balance text-primary md:text-4xl"
        >
          Your next essay starts with a swipe.
        </h2>
        <p className="max-w-[50ch] text-muted-foreground">
          No account needed. Try the demo project, or start your own with your research question.
        </p>
        <Button
          asChild
          size="lg"
          className="h-12 rounded-xl px-6 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Link href="/app">Try it — no signup</Link>
        </Button>
      </div>
    </section>
  );
}
