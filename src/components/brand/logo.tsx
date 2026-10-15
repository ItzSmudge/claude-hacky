import { Scissors } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl font-display text-xl font-semibold tracking-tight text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <Scissors className="size-5 -rotate-45" strokeWidth={1.75} aria-hidden />
      PaperCut
    </Link>
  );
}
