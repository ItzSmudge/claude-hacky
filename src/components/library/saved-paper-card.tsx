"use client";

import { ExternalLink, Trash2, Undo2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { formatMeta, resolveStances } from "@/components/swipe/card-format";
import { CredibilityBadge } from "@/components/swipe/credibility-badge";
import { StanceChip } from "@/components/swipe/stance-chip";
import { cn } from "@/lib/utils";
import type { ProjectContext } from "@/types/domain";
import type { LibraryItem } from "./library-groups";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Compact index card for the library (LB-01): what it is, why it matters, how to cite it. */
export function SavedPaperCard({
  item,
  claims,
  removed = false,
  pending = false,
  onToggle,
}: {
  item: LibraryItem;
  claims: ProjectContext["claims"];
  /** Removed this session: shown dimmed with Restore instead of Remove. */
  removed?: boolean;
  pending?: boolean;
  onToggle: () => void;
}) {
  const titleId = useId();
  const { paper, analysis, credibility, citeKey } = item;
  const meta = formatMeta(paper);
  const stances = analysis ? resolveStances(analysis.stances, claims) : [];
  const whyItMatters = analysis?.whyItMatters.trim();

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper transition-opacity duration-200 md:p-6 hc:border-2",
        removed && "opacity-60 shadow-none hc:opacity-100",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm break-words text-muted-foreground">
          {meta.author} · {meta.venue} · {meta.year}
        </p>
        <CredibilityBadge credibility={credibility} />
      </header>

      <h3
        id={titleId}
        className={cn(
          "font-display text-lg leading-snug font-semibold text-balance text-primary",
          removed && "line-through decoration-1",
        )}
      >
        {paper.title}
        {removed && <span className="sr-only"> (removed)</span>}
      </h3>

      {whyItMatters && !removed && (
        <p className="rounded-xl bg-highlight px-3 py-2 text-sm font-medium text-highlight-foreground hc:border-2 hc:border-primary">
          <span className="sr-only">Why it matters: </span>
          {whyItMatters}
        </p>
      )}

      {stances.length > 0 && !removed && (
        <ul className="flex flex-wrap gap-2" aria-label="Stance toward your claims">
          {stances.map((s) => (
            <li key={s.claimId}>
              <StanceChip stance={s.stance} claim={s.label} claimText={s.claimText} note={s.note} />
            </li>
          ))}
        </ul>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <code className="font-mono text-sm break-all text-muted-foreground">{`\\cite{${citeKey}}`}</code>
        <div className="-mr-2 flex items-center">
          {paper.url && !removed && (
            <Button asChild variant="ghost" className={cn("min-h-11 rounded-xl", FOCUS_RING)}>
              <a href={paper.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
                Open
                <span className="sr-only"> {paper.title} (opens in a new tab)</span>
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onToggle}
            disabled={pending}
            aria-describedby={titleId}
            className={cn(
              "min-h-11 rounded-xl",
              FOCUS_RING,
              !removed && "text-muted-foreground hover:text-challenges",
            )}
          >
            {removed ? (
              <Undo2 className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            {removed ? "Restore" : "Remove"}
          </Button>
        </div>
      </footer>
    </article>
  );
}
