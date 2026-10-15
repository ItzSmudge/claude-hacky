"use client";

import { Bookmark, ExternalLink, FileText, Link2, X } from "lucide-react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ProjectContext, SwipeDecision } from "@/types/domain";
import { formatMeta, resolveStances } from "./card-format";
import { CredibilityBadge } from "./credibility-badge";
import { formatAuthorList, orNotStated, paperLinks, type PaperLink } from "./detail-format";
import { StanceChip } from "./stance-chip";
import type { DeckItem } from "./swipe-deck";

const DESKTOP = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Side panel from md up, bottom sheet below (and during SSR). */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

const LINK_ICON: Record<PaperLink["kind"], typeof Link2> = {
  page: ExternalLink,
  doi: Link2,
  pdf: FileText,
};

// Matches DeckControls: grows at 200% text, opaque focus ring with offset.
const actionClass =
  "h-auto min-h-12 flex-1 gap-2 rounded-xl py-1.5 text-base whitespace-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hc:focus-visible:ring-4";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
      {children}
    </section>
  );
}

function Prose({ text, missing }: { text: string | undefined; missing: string }) {
  return text ? (
    <p className="max-w-[65ch] text-base leading-relaxed whitespace-pre-line">{text}</p>
  ) : (
    <p className="text-base text-muted-foreground italic">{missing}</p>
  );
}

/**
 * Full record for the top card: abstract, methodology, limitations, stance notes, authors, links.
 * Bibliographic text and links render from `paper` only; analysis text from `analysis`.
 */
export function DetailSheet({
  item,
  claims,
  open,
  onOpenChange,
  onDecide,
}: {
  item: DeckItem | null;
  claims: ProjectContext["claims"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecide: (decision: SwipeDecision) => void;
}) {
  const isDesktop = useIsDesktop();
  // Closed by Save/Skip: the deck moves focus itself, so don't restore it to the leaving card.
  const decided = useRef(false);

  if (!item) return null;
  const { paper, analysis, credibility } = item;
  const meta = formatMeta(paper);
  const stances = resolveStances(analysis.stances, claims);
  const links = paperLinks(paper);
  const whyItMatters = orNotStated(analysis.whyItMatters);
  const overview = orNotStated(analysis.overview);

  function decide(decision: SwipeDecision) {
    decided.current = true;
    onOpenChange(false);
    onDecide(decision);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          decided.current = false;
          // Focus the sheet itself so screen readers start at the title, not the first button.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (decided.current) event.preventDefault();
        }}
        className={cn(
          "gap-0 p-0 text-base focus-visible:outline-none motion-reduce:animate-none hc:border-2 hc:border-primary",
          isDesktop
            ? "w-full data-[side=right]:sm:max-w-md"
            : "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <SheetHeader className="gap-3 border-b border-primary/30 px-5 pt-4 pb-4 md:px-6 hc:border-primary">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">
              <span className="block font-medium break-words text-foreground/80">{meta.venue}</span>
              <span className="block">{meta.year}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <CredibilityBadge credibility={credibility} />
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-5" strokeWidth={1.75} aria-hidden />
                  <span className="sr-only">Close details</span>
                </Button>
              </SheetClose>
            </div>
          </div>
          <SheetTitle className="font-display text-2xl leading-snug font-semibold text-balance text-primary">
            {paper.title}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{formatAuthorList(paper.authors)}</p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">
          <SheetDescription asChild>
            <p className="rounded-xl bg-highlight px-3 py-2 text-base font-medium text-highlight-foreground hc:border-2 hc:border-primary">
              {whyItMatters ? (
                <>
                  <span className="sr-only">Why it matters: </span>
                  {whyItMatters}
                </>
              ) : (
                <span className="italic">Why it matters: not stated</span>
              )}
            </p>
          </SheetDescription>

          {overview && <p className="max-w-[65ch] text-base leading-relaxed">{overview}</p>}

          <Section title="Abstract">
            <Prose text={orNotStated(paper.abstract)} missing="Abstract not stated." />
          </Section>

          <Section title="Methodology">
            <Prose text={orNotStated(analysis.methodology)} missing="Not stated." />
          </Section>

          <Section title="Limitations">
            <Prose text={orNotStated(analysis.limitations)} missing="Not stated." />
          </Section>

          {stances.length > 0 && (
            <Section title="Your claims">
              <ul className="flex flex-col gap-4">
                {stances.map((s) => {
                  const note = orNotStated(s.note);
                  return (
                    <li key={s.claimId} className="flex flex-col gap-1.5">
                      <StanceChip stance={s.stance} claim={s.label} className="self-start" />
                      <p className="text-sm text-muted-foreground">{s.claimText}</p>
                      <p className={cn("text-base", !note && "text-muted-foreground italic")}>
                        {note ?? "Not stated."}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {paper.topics.length > 0 && (
            <Section title="Topics">
              <ul className="flex flex-wrap gap-2">
                {paper.topics.map((topic) => (
                  <li
                    key={topic}
                    className="rounded-full border border-border px-2.5 py-0.5 text-sm text-muted-foreground hc:border-2"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {links.length > 0 && (
            <Section title="Links">
              <ul className="flex flex-col gap-1">
                {links.map((link) => {
                  const Icon = LINK_ICON[link.kind];
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 font-medium break-all text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                        {link.kind === "doi" ? (
                          <span>
                            DOI <span className="font-mono text-sm">{link.label}</span>
                          </span>
                        ) : (
                          link.label
                        )}
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>

        <SheetFooter className="flex-row gap-3 border-t border-border bg-popover px-5 py-3 md:px-6 hc:border-primary">
          <Button variant="outline" className={actionClass} onClick={() => decide("skip")}>
            <X className="size-5 text-challenges" strokeWidth={1.75} aria-hidden />
            Skip
          </Button>
          <Button className={actionClass} onClick={() => decide("save")}>
            <Bookmark className="size-5" strokeWidth={1.75} aria-hidden />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
