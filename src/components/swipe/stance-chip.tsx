import { HelpCircle, Minus, Swords, ThumbsUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stance } from "@/types/domain";

const STANCE: Record<Stance, { label: string; Icon: LucideIcon; className: string }> = {
  supports: { label: "Supports", Icon: ThumbsUp, className: "text-supports border-supports/40" },
  challenges: {
    label: "Challenges",
    Icon: Swords,
    className: "text-challenges border-challenges/40",
  },
  neutral: { label: "Neutral", Icon: Minus, className: "text-neutral border-neutral/40" },
  unclear: {
    label: "Unclear",
    Icon: HelpCircle,
    className: "text-neutral border-neutral/60 border-dashed",
  },
};

/** Stance is never colour-only: every chip has an icon and a text label. */
export function StanceChip({
  stance,
  claim,
  className,
}: {
  stance: Stance;
  /** Short claim label, e.g. "Claim 1". */
  claim?: string;
  className?: string;
}) {
  const { label, Icon, className: tone } = STANCE[stance];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-sm",
        tone,
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {claim ? <span className="text-muted-foreground">{claim}:</span> : null}
      {label}
    </span>
  );
}
