"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const ROLL = { type: "tween", duration: 0.25, ease: "easeOut" } as const;

/**
 * A short value (a count, "3 swiping") that rolls up when it changes: the new value slides in
 * from below as the old one leaves upwards. Instant under reduced motion. Purely visual (hidden
 * from screen readers, which would read old and new values mid-roll): callers put the plain text
 * next to it in an sr-only span.
 */
export function RollingText({ value, className }: { value: string | number; className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    // relative: popLayout positions the leaving value absolutely, so this box must clip it.
    <span aria-hidden className={cn("relative inline-grid overflow-hidden", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduceMotion ? false : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={
            reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { y: "-100%", opacity: 0 }
          }
          transition={ROLL}
          className="[grid-area:1/1]"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
