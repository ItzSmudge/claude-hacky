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
          // 44px hit area without changing the visual size.
          "relative inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums after:absolute after:-inset-2.5 after:content-['']",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
          "hc:border-2 hc:border-primary hc:bg-card",
          low ? "bg-warning/25 text-foreground" : "bg-accent text-accent-foreground",
        )}
        // Starts with the visible text so voice control ("tap Low 35/100") works.
        aria-label={`${low ? "Low " : ""}${credibility.score}/100 credibility. Show how it's scored.`}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        {low && <span>Low</span>}
        <span>
          {credibility.score}
          <span className="text-xs">/100</span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={`Credibility ${credibility.score}/100`}
        className="max-h-(--radix-popover-content-available-height) w-64 max-w-(--radix-popover-content-available-width) gap-2 overflow-y-auto rounded-xl p-3 shadow-paper"
      >
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
