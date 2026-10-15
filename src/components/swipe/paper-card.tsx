import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Credibility, Paper, PaperAnalysis, ProjectContext } from "@/types/domain";
import { CredibilityBadge } from "./credibility-badge";
import { StanceChip } from "./stance-chip";

/**
 * Static paper index card (design reference from F-14; SW-01 owns its evolution).
 * Anatomy per docs/SETUP_PLAN.md §2b: meta row → title → why it matters → overview → stances →
 * relevance → details hint.
 */
export function PaperCard({
  paper,
  analysis,
  credibility,
  claims,
  className,
}: {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
  claims: ProjectContext["claims"];
  className?: string;
}) {
  const claimLabel = (id: string) => `Claim ${claims.findIndex((c) => c.id === id) + 1}`;

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper md:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="min-w-0 truncate">
          {[paper.venue, paper.year].filter(Boolean).join(", ") || "Venue not listed"}
        </p>
        <CredibilityBadge credibility={credibility} />
      </div>

      <h2 className="line-clamp-3 font-display text-xl leading-snug font-semibold text-primary">
        {paper.title}
      </h2>

      <p className="rounded-xl bg-highlight px-3 py-2 font-medium text-highlight-foreground">
        {analysis.whyItMatters}
      </p>

      <p className="max-w-[65ch] text-base">{analysis.overview}</p>

      {analysis.stances.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Stance toward your claims">
          {analysis.stances.map((s) => (
            <li key={s.claimId}>
              <StanceChip stance={s.stance} claim={claimLabel(s.claimId)} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label="Relevance to your project"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={analysis.relevance}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${analysis.relevance}%` }}
          />
        </div>
        <span className="w-8 text-right text-sm font-medium tabular-nums">
          {analysis.relevance}
        </span>
      </div>

      <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
        Details
      </p>
    </article>
  );
}
