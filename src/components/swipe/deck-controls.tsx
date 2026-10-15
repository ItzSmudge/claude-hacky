import { Bookmark, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function Key({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden
      className="ml-1 hidden rounded border border-current/30 px-1 font-mono text-xs md:inline"
    >
      {children}
    </kbd>
  );
}

const base = "h-12 gap-2 rounded-xl text-base";

/** Skip · Undo · Save — the always-visible, non-gesture way to use the deck. */
export function DeckControls({
  onSkip,
  onUndo,
  onSave,
  canUndo,
  disabled,
}: {
  onSkip: () => void;
  onUndo: () => void;
  onSave: () => void;
  canUndo: boolean;
  disabled: boolean;
}) {
  return (
    <div role="group" aria-label="Decide on this paper" className="grid grid-cols-3 gap-3">
      <Button
        variant="outline"
        className={base}
        onClick={onSkip}
        disabled={disabled}
        aria-keyshortcuts="ArrowLeft"
      >
        <X className="size-5 text-challenges" strokeWidth={1.75} aria-hidden />
        Skip
        <Key>←</Key>
      </Button>
      <Button
        variant="ghost"
        className={base}
        onClick={onUndo}
        disabled={!canUndo}
        aria-keyshortcuts="Z"
      >
        <Undo2 className="size-5" strokeWidth={1.75} aria-hidden />
        Undo
        <Key>Z</Key>
      </Button>
      <Button className={base} onClick={onSave} disabled={disabled} aria-keyshortcuts="ArrowRight">
        <Bookmark className="size-5" strokeWidth={1.75} aria-hidden />
        Save
        <Key>→</Key>
      </Button>
    </div>
  );
}
