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
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Credibility,
  Paper,
  PaperAnalysis,
  ProjectContext,
  SwipeDecision,
} from "@/types/domain";
import { DeckControls } from "./deck-controls";
import { CardSkeleton } from "./deck-skeleton";
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

/** Lets a parent (the detail sheet) decide the top card through the deck's own exit path. */
export interface SwipeDeckHandle {
  /** Commits only if `paperId` is still the top card and the deck is idle; returns whether it did. */
  decide: (paperId: string, decision: SwipeDecision) => boolean;
  /** Focuses the deck region (e.g. after a sheet closes with nowhere better to return to). */
  focus: () => void;
  /** The top card's paper id, or null when the deck is empty (AX-03 voice commands). */
  topId: () => string | null;
  /** Same as the Undo button / Z key; false when there's nothing to undo. */
  undo: () => boolean;
  /** Same as the Details button / up arrow. */
  details: () => void;
}

export interface DeckItem {
  paper: Paper;
  analysis: PaperAnalysis;
  credibility: Credibility;
}

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const FADE_S = 0.15;
/** Backstop: a stopped motion animation never resolves its promise, so never wait longer than this. */
const ANIMATION_TIMEOUT_MS = 600;
const IGNORE_KEYS_IN = "input, textarea, select, [contenteditable], [role=dialog]";
const NO_DRAG_FROM = "button, a, [role=dialog]";

function safely<A extends unknown[]>(fn: ((...args: A) => void) | undefined, ...args: A) {
  try {
    fn?.(...args);
  } catch (error) {
    console.error("[SwipeDeck] callback failed", error);
  }
}

/** A short tick on phones that support it (Android Chrome; iOS ignores it). Never required. */
function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Unsupported or blocked by permissions policy: haptics are optional.
  }
}

/** Resolves when the animation completes, is stopped, or the timeout passes — whichever is first. */
function settled(start: (done: () => void) => void) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ANIMATION_TIMEOUT_MS);
    start(() => {
      clearTimeout(timer);
      resolve();
    });
  });
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
  loading = false,
  onLoadMore,
  onStartOver,
  libraryHref,
  className,
  ref,
}: {
  ref?: Ref<SwipeDeckHandle>;
  items: DeckItem[];
  claims: ProjectContext["claims"];
  onDecide?: (paperId: string, decision: SwipeDecision) => void;
  onUndo?: (paperId: string, decision: SwipeDecision) => void;
  onDetails?: (paperId: string) => void;
  onEmpty?: () => void;
  loading?: boolean;
  onLoadMore?: () => void;
  /** Shown at the end when you've swiped here before: clears your swipes so you can go again. */
  onStartOver?: () => void;
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
  // Stamps slam down (shrink to size as they appear); the card takes a faint wash of the same ink.
  const saveStampScale = useTransform(x, [40, 120], [1.5, 1]);
  const skipStampScale = useTransform(x, [-120, -40], [1, 1.5]);
  const saveTint = useTransform(x, [0, 160], [0, 1]);
  const skipTint = useTransform(x, [-160, 0], [1, 0]);
  const dragControls = useDragControls();

  const cardRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const keysId = useId();
  // Read the key instructions on the deck's first focus only; after that its name is enough.
  const [keysHeard, setKeysHeard] = useState(false);
  // Focus the deck once it shows the new top card: focusing earlier reads the departing title.
  const focusAfterRender = useRef(false);
  // The top card changed because of a decision or undo here (already announced).
  const decidedHere = useRef(false);
  const deckRef = useRef(deck);
  const busy = useRef(false);
  const dragging = useRef(false);
  const pointerCancelled = useRef(false);
  const entering = useRef<{ paperId: string; from: 1 | -1 } | null>(null);
  const emptyFired = useRef(false);

  const [flash, setFlash] = useState<SwipeDecision | null>(null);
  const [announcement, setAnnouncementText] = useState("");
  const announceFrame = useRef(0);
  const setAnnouncementNow = (text: string) => {
    cancelAnimationFrame(announceFrame.current);
    setAnnouncementText(text);
  };
  // Clear, then set on the next frame, so an identical message (undo/redo) is read again.
  const setAnnouncement = (text: string) => {
    setAnnouncementNow("");
    announceFrame.current = requestAnimationFrame(() => setAnnouncementText(text));
  };

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

  useLayoutEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    regionRef.current?.focus();
  }, [topId]);

  // AX-01: a re-rank or refresh that drops the top card swaps it silently; say what's on top now.
  const shownTopId = useRef(topId);
  const announceSwap = useEffectEvent(() => {
    const was = shownTopId.current;
    shownTopId.current = topId;
    const self = decidedHere.current;
    decidedHere.current = false;
    if (!self && was !== null && top && was !== topId) {
      setAnnouncement(`Now on top: ${top.paper.title}.`);
    }
  });
  useEffect(() => announceSwap(), [topId]);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  const fireEmpty = useEffectEvent(() => safely(onEmpty));
  useEffect(() => {
    if (left > 0) {
      emptyFired.current = false;
    } else if (!emptyFired.current) {
      emptyFired.current = true;
      fireEmpty();
    }
  }, [left]);

  // AX-01: the skeleton's status disappears silently when cards arrive; say so instead.
  // Adjust-state-during-render (as for `items` above), not an effect.
  const [wasLoading, setWasLoading] = useState(loading);
  // Wait until `items` has been synced into the deck (above), or the batch that ended loading
  // isn't in `deck` yet and this would say "No papers" as the cards arrive.
  if (wasLoading !== loading && items === syncedItems) {
    setWasLoading(loading);
    if (wasLoading && top) {
      setAnnouncementText(`${left} ${left === 1 ? "paper" : "papers"} ready. ${top.paper.title}.`);
    } else if (wasLoading && total === 0) {
      setAnnouncementText("No papers to swipe yet.");
    }
  }

  const canCommit = () => top !== null && !busy.current && !dragging.current;

  async function commit(decision: SwipeDecision, velocity = 0, focusDeck = false) {
    if (!top || busy.current) return;
    busy.current = true;
    if (!reduceMotion) haptic();
    const paper = top.paper;
    const active = document.activeElement;
    // Keep keyboard focus: the card is leaving, or this button is about to be disabled (last card).
    // `focusDeck`: the decision came from outside the deck (detail sheet), so land focus here.
    const moveFocus =
      focusDeck ||
      (cardRef.current?.contains(active) ?? false) ||
      (left === 1 && (sectionRef.current?.contains(active) ?? false));

    if (reduceMotion) {
      setFlash(decision);
      await settled((done) => {
        animate(opacity, 0, { duration: FADE_S, onComplete: done });
      });
    } else {
      const target = (decision === "save" ? 1 : -1) * window.innerWidth;
      const distance = Math.abs(target - x.get());
      const duration = Math.min(0.25, Math.max(0.15, distance / Math.max(Math.abs(velocity), 1)));
      await settled((done) => {
        animate(x, target, { duration, ease: "easeOut", onComplete: done });
      });
    }

    busy.current = false;
    setFlash(null);
    // The card may have been removed from `items` mid-animation: then nothing was decided.
    if (current(deckRef.current)?.paper.id !== paper.id) return;
    // The card behind becomes the top one (re-ranking only reorders the cards after it).
    const next = upcoming(deckRef.current, 1)[0];
    // Only a real focus move reads the new label; the detail sheet may already have focused the deck.
    const focusMoves = moveFocus && document.activeElement !== regionRef.current;
    decidedHere.current = true;
    dispatch({ type: "decide", paperId: paper.id, decision });
    // AX-01: say what's on screen now; focus often stays on Save/Skip. When focus moves to the
    // deck, its label already reads the next title, so don't say it twice.
    const leftNow = remaining(deckRef.current) - 1;
    setAnnouncement(
      `${decision === "save" ? "Saved" : "Skipped"}. ` +
        (next
          ? `${leftNow} left.${focusMoves ? "" : ` Next: ${next.paper.title}.`}`
          : "That's the end of the deck for now."),
    );
    focusAfterRender.current = moveFocus;
    safely(onDecide, paper.id, decision);
  }

  useImperativeHandle(ref, () => ({
    decide: (paperId, decision) => {
      if (!canCommit() || topId !== paperId) return false;
      void commit(decision, 0, true);
      return true;
    },
    focus: () => regionRef.current?.focus(),
    topId: () => topId,
    undo: () => {
      if (!canUndo(deck) || busy.current) return false;
      undo();
      return true;
    },
    details: () => details(),
  }));

  // WCAG 2.4.11: browsers don't scroll a focused control that's "visible" but under the sticky bar.
  function revealAboveBar(event: ReactFocusEvent<HTMLElement>) {
    const bar = barRef.current?.getBoundingClientRect();
    if (!bar) return;
    const rect = event.target.getBoundingClientRect();
    // Never scroll the top of what's focused (the card's title) off screen to show its bottom.
    const overlap = Math.min(rect.bottom + 8 - bar.top, rect.top - 8);
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function undo() {
    if (busy.current) return;
    const last = lastDecision(deck);
    if (!last) return;
    entering.current = { paperId: last.paperId, from: last.decision === "save" ? 1 : -1 };
    // Undo is about to be disabled (history empties): keep focus in the deck.
    const moveFocus =
      deck.history.length === 1 && (sectionRef.current?.contains(document.activeElement) ?? false);
    decidedHere.current = true;
    dispatch({ type: "undo" });
    // When focus moves to the deck, its label already reads the restored title.
    const title = deck.known[last.paperId]?.paper.title ?? "paper";
    const focusMoves = moveFocus && document.activeElement !== regionRef.current;
    setAnnouncement(`Restored${focusMoves ? "" : `: ${title}`}. ${left + 1} left.`);
    focusAfterRender.current = moveFocus;
    if (!reduceMotion) haptic();
    safely(onUndo, last.paperId, last.decision);
  }

  function details() {
    // Not while a card is leaving: the sheet would open for the departing paper.
    if (topId && !busy.current) safely(onDetails, topId);
  }

  function startDrag(event: ReactPointerEvent) {
    if (reduceMotion || busy.current) return;
    if (event.target instanceof Element && event.target.closest(NO_DRAG_FROM)) return;
    pointerCancelled.current = false;
    dragging.current = true;
    dragControls.start(event);
  }

  // Velocity must come from PanInfo: the motion value's own velocity reads 0 once the drag ends.
  function endDrag(_event: PointerEvent, info: PanInfo) {
    dragging.current = false;
    if (busy.current) return;
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
    if (event.defaultPrevented || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    // WCAG 2.1.4: shortcuts only act when focus is on the page itself or inside the deck.
    const target = event.target;
    const inDeck = target instanceof Node && (sectionRef.current?.contains(target) ?? false);
    if (target !== document.body && !inDeck) return;
    if (target instanceof Element && target.closest(IGNORE_KEYS_IN)) return;

    // preventDefault only when the key does something, so arrows still scroll otherwise.
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft":
        if (!canCommit()) return;
        event.preventDefault();
        void commit(event.key === "ArrowRight" ? "save" : "skip");
        break;
      case "ArrowUp":
        if (!onDetails || !top || busy.current) return;
        event.preventDefault();
        details();
        break;
      case "z":
      case "Z":
        if (!canUndo(deck) || busy.current) return;
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
    <section
      ref={sectionRef}
      aria-label="Paper deck"
      className={cn("flex flex-col gap-4", className)}
    >
      {/* Before the card so it's in reading order. Buttons first: screen-reader browse mode and
          phones don't send arrow keys. */}
      <p id={keysId} className="sr-only">
        Use the Skip, Undo and Save buttons after the card. With a keyboard: right arrow saves, left
        arrow skips{onDetails ? ", up arrow opens details" : ""} and Z undoes.
      </p>
      <div
        ref={regionRef}
        role="group"
        tabIndex={-1}
        aria-keyshortcuts={onDetails ? "ArrowLeft ArrowRight ArrowUp Z" : "ArrowLeft ArrowRight Z"}
        aria-describedby={keysHeard ? undefined : keysId}
        aria-label={
          top
            ? `Paper ${deck.cursor + 1} of ${total}: ${top.paper.title}`
            : loading
              ? "Loading papers"
              : "No papers left"
        }
        onFocus={revealAboveBar}
        // On blur, not focus: the description must still be there when the screen reader reads it.
        onBlur={(event) => {
          if (event.target === event.currentTarget) setKeysHeard(true);
        }}
        className="grid rounded-2xl *:[grid-area:1/1] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {stack.map((item, i) => {
          const depth = stack.length - i;
          return (
            <motion.div
              key={item.paper.id}
              inert
              initial={false}
              // A slightly messy pile: back cards sit a degree or so off square.
              animate={{
                scale: 1 - 0.04 * depth,
                y: 8 * depth,
                rotate: reduceMotion ? 0 : depth % 2 ? 1.5 : -1,
              }}
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
              <PaperCard {...top} claims={claims} onDetails={onDetails ? details : undefined} />
              <motion.div
                aria-hidden
                style={{ opacity: flash === "save" ? 1 : saveTint }}
                className="pointer-events-none absolute inset-0 rounded-2xl bg-primary/10 ring-2 ring-primary/40 ring-inset"
              />
              <motion.div
                aria-hidden
                style={{ opacity: flash === "skip" ? 1 : skipTint }}
                className="pointer-events-none absolute inset-0 rounded-2xl bg-challenges/10 ring-2 ring-challenges/40 ring-inset"
              />
              <motion.span
                aria-hidden
                style={{
                  opacity: flash === "save" ? 1 : saveStamp,
                  scale: flash === "save" ? 1 : saveStampScale,
                }}
                className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-lg border-4 border-primary bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-primary uppercase"
              >
                Saved
              </motion.span>
              <motion.span
                aria-hidden
                style={{
                  opacity: flash === "skip" ? 1 : skipStamp,
                  scale: flash === "skip" ? 1 : skipStampScale,
                }}
                className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-lg border-4 border-challenges bg-card/80 px-3 py-1 font-display text-3xl font-semibold tracking-wide text-challenges uppercase"
              >
                Skip
              </motion.span>
            </motion.div>
          </motion.div>
        ) : loading ? (
          <CardSkeleton />
        ) : (
          <div className="flex animate-in flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-paper duration-300 zoom-in-95 fade-in">
            <p className="font-display text-xl font-semibold text-primary">
              {total === 0 && !onStartOver
                ? "No papers to swipe yet."
                : "You've been through every paper."}
            </p>
            {total > 0 ? (
              <p className="text-muted-foreground">
                Undo to revisit the last one{libraryHref ? ", or open your library." : "."}
              </p>
            ) : (
              onStartOver && (
                <p className="text-muted-foreground">
                  Your saves are in your library. Start over to swipe them all again.
                </p>
              )
            )}
            {onStartOver && (
              <Button variant="secondary" className="min-h-11" onClick={onStartOver}>
                <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
                Start over
              </Button>
            )}
            {onLoadMore && (
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => {
                  // The button unmounts once loading starts: keep focus in the deck.
                  regionRef.current?.focus();
                  onLoadMore();
                }}
              >
                Load more papers
              </Button>
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

      {/* Sticky so the buttons are on screen without scrolling on phones and short screens — the
          only input with reduced motion. Last in the deck, so at the end it rests in normal flow.
          safe-area padding takes effect once the root viewport opts into viewport-fit=cover. */}
      <div
        ref={barRef}
        className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:mx-0 sm:rounded-2xl sm:border sm:px-3 hc:border-t-2 hc:bg-background hc:backdrop-blur-none sm:hc:border-2 [@media(max-height:480px)]:pt-1.5 [@media(max-height:480px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <DeckControls
          onSkip={() => canCommit() && void commit("skip")}
          onUndo={undo}
          onSave={() => canCommit() && void commit("save")}
          canUndo={canUndo(deck)}
          disabled={!top}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
