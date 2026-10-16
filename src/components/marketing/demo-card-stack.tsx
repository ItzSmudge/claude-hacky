"use client";

import { Pause, Play, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Just what the hero card needs; picked from fixtures on the server so no JSON ships to the client. */
export interface DemoCard {
  id: string;
  title: string;
  meta: string;
  score: number;
  whyItMatters: string;
}

/** save, save, skip — so both stamps show up in one loop. */
const DECISIONS = ["save", "save", "skip"] as const;
const INTERVAL_MS = 3200;
const STACK = 3;

/**
 * Hero demo (MK-02): real fixture papers swiping themselves. Decorative, so hidden from screen
 * readers (the hero copy says the same thing). Static under reduced motion; pausable otherwise.
 */
export function DemoCardStack({ cards }: { cards: DemoCard[] }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const animate = !reduceMotion && !paused && cards.length > 1;

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setIndex((i) => i + 1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [animate]);

  if (cards.length === 0) return null;
  const visible = Array.from({ length: Math.min(STACK, cards.length) }, (_, depth) => ({
    depth,
    card: cards[(index + depth) % cards.length]!,
    key: index + depth,
  }));
  const decision = DECISIONS[index % DECISIONS.length]!;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div aria-hidden className="relative h-72">
        <AnimatePresence initial={false}>
          {[...visible].reverse().map(({ depth, card, key }) => (
            <motion.div
              key={key}
              className="absolute inset-x-0 top-0"
              style={{ zIndex: STACK - depth }}
              initial={{ y: 24, scale: 0.92, opacity: 0 }}
              animate={{
                y: depth * 14,
                scale: 1 - depth * 0.04,
                rotate: depth === 0 ? 0 : depth % 2 ? -3 : 3,
                opacity: 1,
              }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      x: decision === "save" ? 320 : -320,
                      rotate: decision === "save" ? 12 : -12,
                      opacity: 0,
                    }
              }
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <MiniCard card={card} stamp={depth === 0 && animate ? decision : undefined} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!reduceMotion && cards.length > 1 && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="mx-auto mt-2 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-cream-100 transition-colors hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-cream-200 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700 focus-visible:outline-none"
        >
          {paused ? (
            <Play className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <Pause className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {paused ? "Play demo" : "Pause demo"}
        </button>
      )}
    </div>
  );
}

function MiniCard({ card, stamp }: { card: DemoCard; stamp?: "save" | "skip" }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-cream-300 bg-card p-5 text-left text-card-foreground shadow-paper-lg dark:border-teal-800">
      <div className="flex items-start justify-between gap-3 border-b border-primary/30 pb-3 text-sm text-muted-foreground">
        <span className="line-clamp-2 min-w-0">{card.meta}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground tabular-nums">
          <ShieldCheck className="size-4" strokeWidth={1.75} />
          {card.score}
          <span className="text-xs">/100</span>
        </span>
      </div>
      <p className="line-clamp-3 font-display text-lg leading-snug font-semibold text-primary">
        {card.title}
      </p>
      <p className="line-clamp-2 rounded-xl bg-highlight px-3 py-2 text-sm font-medium text-highlight-foreground">
        {card.whyItMatters}
      </p>
      {stamp && (
        <motion.span
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: (INTERVAL_MS - 900) / 1000, duration: 0.2 }}
          className={cn(
            "absolute top-24 rounded-lg border-4 bg-card/80 px-3 py-1 font-display text-2xl font-semibold tracking-wider uppercase",
            stamp === "save"
              ? "left-5 -rotate-12 border-primary text-primary"
              : "right-5 rotate-12 border-challenges text-challenges",
          )}
        >
          {stamp === "save" ? "Saved" : "Skip"}
        </motion.span>
      )}
    </div>
  );
}
