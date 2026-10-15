import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Credibility } from "@/types/domain";

const LOW_SCORE = 40;

const INPUT_LABELS: Record<string, string> = {
  citationCount: "Citations",
  peerReviewed: "Peer reviewed",
  venueType: "Venue type",
  year: "Year",
};

function formatInput(key: string, value: number | string | boolean) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  // Thousands separators for counts only — never for years.
  if (typeof value === "number" && key === "citationCount") return value.toLocaleString("en-GB");
  return String(value);
}

/**
 * Credibility is computed by code (src/lib/credibility.ts); the popover shows its inputs.
 * A popover (not a tooltip) so it opens on tap — judges test on phones.
 */
export function CredibilityBadge({ credibility }: { credibility: Credibility }) {
  const low = credibility.score < LOW_SCORE;
  const Icon = low ? ShieldAlert : ShieldCheck;
  const inputs = Object.entries(credibility.inputs);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          "hc:border-2 hc:border-primary",
          low ? "bg-warning/25 text-foreground" : "bg-accent text-accent-foreground",
        )}
        aria-label={`Credibility ${credibility.score} out of 100${low ? ", low" : ""}. Show how it's scored.`}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        {low && <span>Low</span>}
        <span>
          {credibility.score}
          <span className="text-xs opacity-70">/100</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-2 rounded-xl p-3 shadow-paper">
        <p className="font-medium">Credibility {credibility.score}/100</p>
        {inputs.length > 0 ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            {inputs.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{INPUT_LABELS[key] ?? key}</dt>
                <dd className="text-right tabular-nums">{formatInput(key, value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">Inputs not stated.</p>
        )}
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          Scored from paper metadata, not AI.
        </p>
      </PopoverContent>
    </Popover>
  );
}
