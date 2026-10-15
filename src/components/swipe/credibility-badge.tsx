import { ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Credibility } from "@/types/domain";

const INPUT_LABELS: Record<string, string> = {
  citationCount: "Citations",
  peerReviewed: "Peer reviewed",
  venueType: "Venue type",
  year: "Year",
};

function formatInput(value: number | string | boolean) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Credibility is computed by code (src/lib/credibility.ts); the tooltip shows its inputs. */
export function CredibilityBadge({ credibility }: { credibility: Credibility }) {
  const low = credibility.score < 40;
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          low ? "bg-warning/20 text-foreground" : "bg-accent text-accent-foreground",
        )}
        aria-label={`Credibility ${credibility.score} out of 100. Show how it's calculated.`}
      >
        <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden />
        {credibility.score}
      </TooltipTrigger>
      <TooltipContent>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
          {Object.entries(credibility.inputs).map(([key, value]) => (
            <div key={key} className="contents">
              <dt>{INPUT_LABELS[key] ?? key}</dt>
              <dd className="text-right">{formatInput(value)}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
