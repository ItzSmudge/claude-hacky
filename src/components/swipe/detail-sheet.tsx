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
  "h-auto min-h-12 flex-1 basis-32 gap-2 rounded-xl py-1.5 text-base whitespace-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hc:focus-visible:ring-4";

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
  onFocusDeck,
}: {
  item: DeckItem | null;
  claims: ProjectContext["claims"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns false when the deck can't take it (busy, or this paper is no longer on top). */
  onDecide: (paperId: string, decision: SwipeDecision) => boolean;
  /** Moves focus to the deck (used when there is nothing better to return focus to). */
  onFocusDeck: () => void;
}) {
  const isDesktop = useIsDesktop();
  // Save/Skip waits until the sheet has closed, so the deck's announcement isn't hidden by the
  // dialog's aria-hidden on the rest of the page.
  const pending = useRef<{ paperId: string; decision: SwipeDecision } | null>(null);
  const opener = useRef<Element | null>(null);

  if (!item) return null;
  const { paper, analysis, credibility } = item;
  const meta = formatMeta(paper);
  const stances = resolveStances(analysis.stances, claims);
  const links = paperLinks(paper);
  const whyItMatters = orNotStated(analysis.whyItMatters);
  const overview = orNotStated(analysis.overview);

  function decide(decision: SwipeDecision) {
    pending.current = { paperId: paper.id, decision };
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          pending.current = null;
          opener.current = document.activeElement;
          // Focus the scrollable body: arrow keys / PgDn scroll it, and the dialog name is read.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)
            ?.querySelector<HTMLElement>("[data-sheet-body]")
            ?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const decision = pending.current;
          pending.current = null;
          // The deck took it: it focuses its own region (the card is leaving).
          if (decision && onDecide(decision.paperId, decision.decision)) {
            event.preventDefault();
            onFocusDeck();
            return;
          }
          // Opened with ↑ from the page: land in the deck rather than on <body>.
          const back = opener.current;
          if (!back || back === document.body || !back.isConnected) {
            event.preventDefault();
            onFocusDeck();
          }
        }}
        className={cn(
          "gap-0 p-0 text-base focus-visible:outline-none motion-reduce:animate-none hc:border-2 hc:border-primary",
          isDesktop
            ? "w-full data-[side=right]:sm:max-w-md"
            : "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 size-11 rounded-xl bg-popover shadow-paper focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover hc:border-2 hc:border-primary"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Close details</span>
          </Button>
        </SheetClose>

        {/* Everything but the action bar scrolls, so Save/Skip stay reachable at 200% text. */}
        <div
          data-sheet-body
          tabIndex={0}
          role="region"
          aria-label="Paper details"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 pb-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset md:px-6"
        >
          <SheetHeader className="-mx-5 gap-3 border-b border-primary/30 px-5 pt-4 pb-4 md:-mx-6 md:px-6 hc:border-primary">
            <SheetTitle className="font-display text-2xl leading-snug font-semibold text-balance text-primary">
              {paper.title}
            </SheetTitle>
            {/* Title first for screen readers; meta shown above it. Right padding clears the close button. */}
            <div className="order-first flex flex-wrap items-start justify-between gap-x-3 gap-y-2 pr-12">
              <p className="min-w-0 text-sm text-muted-foreground">
                <span className="block font-medium break-words text-foreground/80">
                  {meta.venue}
                </span>
                <span className="block">{meta.year}</span>
              </p>
              <CredibilityBadge credibility={credibility} />
            </div>
            <p className="text-sm text-muted-foreground">{formatAuthorList(paper.authors)}</p>
          </SheetHeader>

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
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 font-medium break-all text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none"
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

        <SheetFooter className="flex-row flex-wrap gap-3 border-t border-border bg-popover px-5 py-3 md:px-6 hc:border-primary">
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
