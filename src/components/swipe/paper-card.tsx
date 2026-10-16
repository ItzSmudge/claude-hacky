import { ChevronUp } from "lucide-react";
import { ReadAloud } from "@/components/a11y/read-aloud";
import { cardScript } from "@/components/a11y/speech";
import { cn } from "@/lib/utils";
import type { Credibility, Paper, PaperAnalysis, ProjectContext } from "@/types/domain";
import { clampRelevance, formatMeta, resolveStances } from "./card-format";
import { CredibilityBadge } from "./credibility-badge";
import { StanceChip } from "./stance-chip";

const NOT_STATED = "not stated";

/**
 * Paper index card for the swipe deck.
 * Anatomy (design-system skill): meta row → catalogue rule → title → why it matters → overview →
 * stances → relevance → details hint. All bibliographic text comes from `paper` (scholar APIs).
 */
export function PaperCard({
  paper,
  analysis,
  credibility,
  claims,
  onDetails,
  className,
}: {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
  claims: ProjectContext["claims"];
  /** Makes the "Details" hint a real button (the deck passes this for the top card). */
  onDetails?: () => void;
  className?: string;
}) {
  const meta = formatMeta(paper);
  const stances = resolveStances(analysis.stances, claims);
  const relevance = clampRelevance(analysis.relevance);
  const whyItMatters = analysis.whyItMatters.trim();
  const overview = analysis.overview.trim();

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper md:p-6 hc:border-2",
        className,
      )}
    >
      {/* Catalogue-card header: the one ruled line under the meta row. */}
      <header className="-mx-5 flex items-start justify-between gap-3 border-b border-primary/30 px-5 pb-3 md:-mx-6 md:px-6 hc:border-primary">
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className="block font-medium break-words text-foreground/80">{meta.venue}</span>
          <span className="block break-words">
            {meta.author}, {meta.year}
          </span>
        </p>
        <CredibilityBadge credibility={credibility} />
      </header>

      <h2 className="line-clamp-3 font-display text-xl leading-snug font-semibold text-balance text-primary">
        {paper.title}
      </h2>

      <p className="highlight-sweep rounded-xl px-3 py-2 font-medium text-highlight-foreground hc:border-2 hc:border-primary">
        {whyItMatters ? (
          <>
            <span className="sr-only">Why it matters: </span>
            {whyItMatters}
          </>
        ) : (
          <span className="italic">Why it matters: {NOT_STATED}</span>
        )}
      </p>

      <p className="max-w-[65ch] text-base leading-relaxed">
        {overview || <span className="text-muted-foreground">Overview {NOT_STATED}.</span>}
      </p>

      {stances.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Stance toward your claims">
          {stances.map((s) => (
            <li key={s.claimId}>
              <StanceChip stance={s.stance} claim={s.label} claimText={s.claimText} note={s.note} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground" aria-hidden>
          Relevance
        </span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-secondary hc:border hc:border-primary"
          role="meter"
          aria-label="Relevance to your project"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={relevance}
          aria-valuetext={`${relevance} out of 100`}
        >
          <div
            className="h-full fill-in rounded-full bg-primary"
            style={{ width: `${relevance}%` }}
          />
        </div>
        <span className="w-8 text-right font-medium tabular-nums" aria-hidden>
          {relevance}
        </span>
      </div>

      {onDetails ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* AX-02: only the top card (the one with Details) can be read aloud. */}
          <ReadAloud
            parts={cardScript({ title: paper.title, whyItMatters, overview })}
            what="this paper"
          />
          <button
            type="button"
            onClick={onDetails}
            aria-keyshortcuts="ArrowUp"
            className="flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none"
          >
            <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
            Details
            <kbd
              aria-hidden
              className="ml-1 hidden rounded border border-border px-1 font-mono text-xs md:inline"
            >
              ↑
            </kbd>
          </button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
          Details
        </p>
      )}
    </article>
  );
}
