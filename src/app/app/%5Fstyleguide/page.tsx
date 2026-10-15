import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperCard } from "@/components/swipe/paper-card";
import { StanceChip } from "@/components/swipe/stance-chip";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { fixturePapers, fixtureProject } from "@/fixtures";

export const metadata: Metadata = { title: "Styleguide" };

// Class names are listed literally so Tailwind generates them.
const TEAL = [
  ["50", "bg-teal-50"],
  ["100", "bg-teal-100"],
  ["200", "bg-teal-200"],
  ["300", "bg-teal-300"],
  ["400", "bg-teal-400"],
  ["500", "bg-teal-500"],
  ["600", "bg-teal-600"],
  ["700", "bg-teal-700"],
  ["800", "bg-teal-800"],
  ["900", "bg-teal-900"],
  ["950", "bg-teal-950"],
] as const;
const CREAM = [
  ["50", "bg-cream-50"],
  ["100", "bg-cream-100"],
  ["200", "bg-cream-200"],
  ["300", "bg-cream-300"],
  ["400", "bg-cream-400"],
  ["500", "bg-cream-500"],
  ["600", "bg-cream-600"],
  ["700", "bg-cream-700"],
  ["800", "bg-cream-800"],
  ["900", "bg-cream-900"],
  ["950", "bg-cream-950"],
] as const;
const SEMANTIC = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["primary", "bg-primary"],
  ["secondary", "bg-secondary"],
  ["muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["highlight", "bg-highlight"],
  ["border", "bg-border"],
  ["supports", "bg-supports"],
  ["challenges", "bg-challenges"],
  ["neutral", "bg-neutral"],
  ["warning", "bg-warning"],
  ["info", "bg-info"],
  ["destructive", "bg-destructive"],
] as const;

function Swatches({
  title,
  items,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg text-primary">{title}</h3>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {items.map(([name, cls]) => (
          <li key={name} className="flex flex-col gap-1 text-sm">
            <span className={`h-12 rounded-xl border border-border ${cls}`} />
            <span className="text-muted-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl text-primary">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  const sample = fixturePapers[0];
  const lowCred = [...fixturePapers].sort((a, b) => a.credibility.score - b.credibility.score)[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 pb-16">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-primary">Styleguide</h1>
          <p className="max-w-[65ch] text-muted-foreground">
            The reading room: papers are index cards on a warm desk, written in teal ink. Tokens
            live in <code className="font-mono text-sm">globals.css</code>; the full spec is in the
            design-system skill. Toggle the theme to check both.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Section title="Colour">
        <Swatches title="Ink Teal" items={TEAL} />
        <Swatches title="Parchment Cream" items={CREAM} />
        <Swatches title="Theme tokens" items={SEMANTIC} />
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-3">
          <p className="font-display text-5xl font-semibold tracking-tight text-primary md:text-7xl">
            Swipe right on research.
          </p>
          <p className="font-display text-3xl font-semibold text-primary">Page title in Fraunces</p>
          <p className="font-display text-xl font-semibold text-primary">
            Card title: Mechanisms linking social media use to adolescent mental health
          </p>
          <p className="max-w-[65ch]">
            Body text is Inter at 16px with a 1.6 line height and a 65 character measure, so a
            paragraph of an abstract stays comfortable to read on a phone or a laptop.
          </p>
          <p className="text-sm text-muted-foreground">
            Meta text: Nature Reviews Psychology, 2024
          </p>
          <p className="font-mono text-sm">
            {"\\cite{lastnameYEARword}"} doi:{sample.paper.doi ?? "not listed"}
          </p>
        </div>
      </Section>

      <Section title="Buttons and inputs">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Save paper</Button>
          <Button variant="secondary">Export BibTeX</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="outline">Details</Button>
          <Button variant="destructive">Delete project</Button>
        </div>
        <Input placeholder="What are you writing about?" className="max-w-md" />
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2">
          <StanceChip stance="supports" claim="Claim 1" />
          <StanceChip stance="challenges" claim="Claim 2" />
          <StanceChip stance="neutral" />
          <StanceChip stance="unclear" />
          <Badge>evidence</Badge>
          <Badge variant="secondary">background</Badge>
          <Badge variant="outline">method</Badge>
        </div>
      </Section>

      <Section title="Paper card">
        <div className="grid gap-6 md:grid-cols-2">
          <PaperCard {...sample} claims={fixtureProject.context.claims} />
          <PaperCard {...lowCred} claims={fixtureProject.context.claims} />
        </div>
      </Section>
    </div>
  );
}
