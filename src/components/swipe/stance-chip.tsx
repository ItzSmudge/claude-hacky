import { ChevronDown, HelpCircle, Minus, Swords, ThumbsUp, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Stance } from "@/types/domain";

const STANCE: Record<Stance, { label: string; Icon: LucideIcon; className: string }> = {
  supports: {
    label: "Supports",
    Icon: ThumbsUp,
    className: "text-supports border-supports/40 hc:border-current",
  },
  challenges: {
    label: "Challenges",
    Icon: Swords,
    className: "text-challenges border-challenges/40 hc:border-current",
  },
  neutral: {
    label: "Neutral",
    Icon: Minus,
    className: "text-neutral border-neutral/40 hc:border-current",
  },
  unclear: {
    label: "Unclear",
    Icon: HelpCircle,
    className: "text-neutral border-neutral/60 border-dashed",
  },
};

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-sm hc:border-2";

/**
 * Stance is never colour-only: every chip has an icon and a text label.
 * Pass `claimText` to make the chip a button that reveals the claim and the note.
 */
export function StanceChip({
  stance,
  claim,
  claimText,
  note,
  className,
}: {
  stance: Stance;
  /** Short claim label, e.g. "Claim 1". */
  claim?: string;
  /** Full claim text; makes the chip interactive. */
  claimText?: string;
  /** One-line explanation from the analysis. */
  note?: string;
  className?: string;
}) {
  const { label, Icon, className: tone } = STANCE[stance];
  const face = (
    <>
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {claim ? <span className="text-muted-foreground">{claim}:</span> : null}
      {label}
    </>
  );

  if (!claimText) {
    return <span className={cn(chipClass, tone, className)}>{face}</span>;
  }

  // Interactive chips: stronger border + chevron so they read as tappable; 44px hit area via ::after.
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          chipClass,
          "relative min-h-8 transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-muted hc:border-current",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none",
          tone,
          "border-current/70",
          className,
        )}
      >
        {face}
        <span className="sr-only">, about: {claimText}</span>
        <ChevronDown className="size-3.5 opacity-80" strokeWidth={1.75} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={`${label}${claim ? ` ${claim.toLowerCase()}` : ""}`}
        className="max-h-(--radix-popover-content-available-height) w-72 max-w-(--radix-popover-content-available-width) gap-2 overflow-y-auto rounded-xl p-3 shadow-paper"
      >
        <p className={cn("flex items-center gap-1.5 font-medium", tone)}>
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          {label}
          {claim ? ` ${claim.toLowerCase()}` : ""}
        </p>
        <p className="font-display text-base leading-snug">{claimText}</p>
        <p className="text-muted-foreground">{note?.trim() || "Note not stated."}</p>
      </PopoverContent>
    </Popover>
  );
}
