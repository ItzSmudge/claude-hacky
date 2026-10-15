"use client";

import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import type {
  Credibility,
  Paper,
  PaperAnalysis,
  ProjectContext,
  SwipeDecision,
} from "@/types/domain";
import { DeckControls } from "./deck-controls";
import {
  canUndo,
  createDeck,
  current,
  deckReducer,
  lastDecision,
  remaining,
  upcoming,
} from "./deck-state";
import { classifyGesture } from "./gesture";
import { PaperCard } from "./paper-card";

export interface DeckItem {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
}

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const FADE_S = 0.15;
const IGNORE_KEYS_IN = "input, textarea, select, [contenteditable], [role=dialog]";
const NO_DRAG_FROM = "button, a, [role=dialog]";

function safely<A extends unknown[]>(fn: ((...args: A) => void) | undefined, ...args: A) {
  try {
    fn?.(...args);
  } catch (error) {
    console.error("[SwipeDeck] callback failed", error);
  }
}

/**
 * Swipe deck: drag/fling, ← → ↑ Z, Skip/Undo/Save buttons, full-history undo.
 * State lives in deck-state.ts; this component only animates and reports via callbacks.
 */
export function SwipeDeck({
  items,
  claims,
  onDecide,
  onUndo,
  onDetails,
  onEmpty,
  libraryHref,
  className,
}: {
  items: DeckItem[];
  claims: ProjectContext["claims"];
  onDecide?: (paperId: string, decision: SwipeDecision) => void;
  onUndo?: (paperId: string, decision: SwipeDecision) => void;
  onDetails?: (paperId: string) => void;
  onEmpty?: () => void;
  libraryHref?: string;
  className?: string;
}) {
  const [deck, dispatch] = useReducer(deckReducer<DeckItem>, items, createDeck<DeckItem>);
  const reduceMotion = useReducedMotion() ?? false;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const saveStamp = useTransform(x, [40, 120], [0, 1]);
  const skipStamp = useTransform(x, [-120, -40], [1, 0]);
  const dragControls = useDragControls();

  const cardRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pointerCancelled = useRef(false);
  const entering = useRef<{ paperId: string; from: 1 | -1 } | null>(null);
  const emptyFired = useRef(false);

  const [flash, setFlash] = useState<SwipeDecision | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const top = current(deck);
  const topId = top?.paper.id ?? null;
  const behind = upcoming(deck, 2);
  const left = remaining(deck);
  const total = deck.order.length;

  // SW-04 / RK-02 feed new item arrays; only upcoming cards change.
  // Adjust-state-during-render pattern (no effect → no extra paint, lint-clean).
  const [syncedItems, setSyncedItems] = useState(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    dispatch({ type: "replaceUpcoming", items });
  }

  // New top card: reset motion values before paint, or play the undo entrance.
  useLayoutEffect(() => {
    const enter = entering.current;
    entering.current = null;
    y.jump(0);
    if (enter && enter.paperId === topId) {
      if (reduceMotion) {
        x.jump(0);
        opacity.jump(0);
        animate(opacity, 1, { duration: FADE_S });
      } else {
        opacity.jump(1);
        x.jump(enter.from * window.innerWidth);
        animate(x, 0, SPRING);
      }
      return;
    }
    x.jump(0);
    opacity.jump(1);
  }, [topId, reduceMotion, x, y, opacity]);

  const fireEmpty = useEffectEvent(() => safely(onEmpty));
  useEffect(() => {
    if (left > 0) {
      emptyFired.current = false;
    } else if (!emptyFired.current) {
      emptyFired.current = true;
      fireEmpty();
    }
  }, [left]);

  async function commit(decision: SwipeDecision, velocity = 0) {
    if (busy.current || !top) return;
    busy.current = true;
    const paper = top.paper;
    const hadFocus = cardRef.current?.contains(document.activeElement) ?? false;

    if (reduceMotion) {
      setFlash(decision);
      await animate(opacity, 0, { duration: FADE_S });
    } else {
      const target = (decision === "save" ? 1 : -1) * window.innerWidth;
      const distance = Math.abs(target - x.get());
      const duration = Math.min(0.25, Math.max(0.15, distance / Math.max(Math.abs(velocity), 1)));
      await animate(x, target, { duration, ease: "easeOut" });
    }

    dispatch({ type: "decide", decision });
    setFlash(null);
    setAnnouncement(
      `${decision === "save" ? "Saved" : "Skipped"}: ${paper.title}. ${left - 1} left.`,
    );
    if (hadFocus) regionRef.current?.focus();
    busy.current = false;
    safely(onDecide, paper.id, decision);
  }

  function undo() {
    if (busy.current) return;
    const last = lastDecision(deck);
    if (!last) return;
    entering.current = { paperId: last.paperId, from: last.decision === "save" ? 1 : -1 };
    dispatch({ type: "undo" });
    setAnnouncement(`Restored: ${deck.known[last.paperId]?.paper.title ?? "paper"}.`);
    safely(onUndo, last.paperId, last.decision);
  }

  function details() {
    if (topId) safely(onDetails, topId);
  }

  function startDrag(event: ReactPointerEvent) {
    if (reduceMotion || busy.current) return;
    if (event.target instanceof Element && event.target.closest(NO_DRAG_FROM)) return;
    pointerCancelled.current = false;
    dragControls.start(event);
  }

  // Velocity must come from PanInfo: the motion value's own velocity reads 0 once the drag ends.
  function endDrag(_event: PointerEvent, info: PanInfo) {
    const outcome = pointerCancelled.current
      ? null
      : classifyGesture({
          x: x.get(),
          y: y.get(),
          vx: info.velocity.x,
          vy: info.velocity.y,
          width: cardRef.current?.offsetWidth ?? 0,
        });
    if (outcome === "save" || outcome === "skip") {
      void commit(outcome, info.velocity.x);
      return;
    }
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    if (outcome === "details") details();
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest(IGNORE_KEYS_IN)) return;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        void commit("save");
        break;
      case "ArrowLeft":
        event.preventDefault();
        void commit("skip");
        break;
      case "ArrowUp":
        event.preventDefault();
        details();
        break;
      case "z":
      case "Z":
        event.preventDefault();
        undo();
        break;
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const stack = [...behind].reverse();

  return (
    <section aria-label="Paper deck" className={cn("flex flex-col gap-4", className)}>
      <div
        ref={regionRef}
        tabIndex={-1}
        aria-label={top ? `Paper ${deck.cursor + 1} of ${total}` : "No papers left"}
        className="grid rounded-2xl *:[grid-area:1/1] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {stack.map((item, i) => {
          const depth = stack.length - i;
          return (
            <motion.div
              key={item.paper.id}
              inert
              initial={false}
              animate={{ scale: 1 - 0.04 * depth, y: 8 * depth }}
              transition={reduceMotion ? { duration: 0 } : SPRING}
              className="pointer-events-none origin-top"
            >
              <PaperCard {...item} claims={claims} />
            </motion.div>
          );
        })}

        {top ? (
          <motion.div
            key={top.paper.id}
            // A back card promoted to the top remounts here; start at depth-1 and spring forward.
            // Same `initial` on server and client (useReducedMotion is null during SSR); reduced
            // motion gets a zero-duration transition below instead.
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING}
            className="origin-top"
          >
            <motion.div
              ref={cardRef}
              drag={!reduceMotion}
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              onPointerDown={startDrag}
              onPointerCancel={() => {
                pointerCancelled.current = true;
              }}
              onDragEnd={endDrag}
              style={{ x, y, rotate, opacity, touchAction: "pan-y" }}
              className="relative cursor-grab select-none active:cursor-grabbing"
            >
              <PaperCard {...top} claims={claims} onDetails={details} />
              <motion.span
                aria-hidden
                style={{ opacity: flash === "save" ? 1 : saveStamp }}
                className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-lg border-4 border-primary bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-primary uppercase"
              >
                Saved
              </motion.span>
              <motion.span
                aria-hidden
                style={{ opacity: flash === "skip" ? 1 : skipStamp }}
                className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-lg border-4 border-challenges bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-challenges uppercase"
              >
                Skip
              </motion.span>
            </motion.div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-paper">
            <p className="font-display text-xl font-semibold text-primary">
              {total === 0 ? "No papers to swipe yet." : "You've been through every paper."}
            </p>
            {total > 0 && (
              <p className="text-muted-foreground">
                Undo to revisit the last one{libraryHref ? ", or open your library." : "."}
              </p>
            )}
            {libraryHref && (
              <Link
                href={libraryHref}
                className="inline-flex min-h-11 items-center rounded-xl px-4 font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Open library
              </Link>
            )}
          </div>
        )}
      </div>

      <DeckControls
        onSkip={() => void commit("skip")}
        onUndo={undo}
        onSave={() => void commit("save")}
        canUndo={canUndo(deck)}
        disabled={!top}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
