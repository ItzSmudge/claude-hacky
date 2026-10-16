"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { SwipeRequest } from "@/lib/api-schemas";
import {
  applyDeckFilters,
  extractFeatures,
  featurePhrase,
  findInsight,
  rankItems,
  templateSentence,
  type Insight,
  type PaperFeature,
  type SwipeSample,
} from "@/lib/ranking";
import type { ProjectContext, SwipeDecision } from "@/types/domain";
import { speak, stop as stopSpeaking } from "@/components/a11y/read-aloud";
import { cardScript } from "@/components/a11y/speech";
import type { VoiceCommand } from "@/components/a11y/voice";
import { VoiceControl } from "@/components/a11y/voice-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markOffered,
  offeredInsights,
  toDeckFilters,
  useDeckFilters,
  type ActiveFilter,
} from "./deck-filters";
import { DetailSheet } from "./detail-sheet";
import { SwipeDeck, type DeckItem, type SwipeDeckHandle } from "./swipe-deck";
import { classifyStatus, createSwipeSync, type SendResult, type SwipeOp } from "./swipe-sync";
import { usePaperQueue } from "./use-paper-queue";

const TITLE_MAX = 60;
const NO_HISTORY: SwipeSample[] = [];
const NO_ITEMS: DeckItem[] = [];
/** Top so a toast never covers the deck controls on a phone. */
const TOAST_POSITION = "top-center";
/** sonner's buttons are 24px tall; inline style beats its stylesheet. */
const TOAST_BUTTON_STYLE = { minHeight: 44, height: "auto", paddingInline: 16 };
/** RK-03: swipes between two insight toasts. */
const INSIGHT_GAP = 6;
const INSIGHT_TOAST_ID = "rank-insight";
/**
 * Sonner lays a toast out in one row; on a phone two buttons leave the sentence a sliver.
 * Wrap the buttons under the text (`!`: sonner's own CSS is unlayered) and give them our ring.
 */
const INSIGHT_TOAST_CLASSES = {
  toast: "flex-wrap",
  content: "basis-[calc(100%-2rem)]!",
  actionButton:
    "focus-visible:ring-2! focus-visible:ring-ring! focus-visible:ring-offset-2! focus-visible:ring-offset-popover!",
  cancelButton:
    "focus-visible:ring-2! focus-visible:ring-ring! focus-visible:ring-offset-2! focus-visible:ring-offset-popover!",
};
/** The model's sentence is a nicety: after this the template is used instead. */
const INSIGHT_WAIT_MS = 6_000;

/** The model's wording when it answers in time, else the code-made template. */
async function insightSentence(projectId: string, insight: Insight): Promise<string> {
  try {
    const res = await fetch("/api/ranking/insight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        kind: insight.feature.kind,
        label: insight.feature.label,
        direction: insight.direction,
        count: insight.count,
        total: insight.total,
      }),
      signal: AbortSignal.timeout(INSIGHT_WAIT_MS),
    });
    if (res.ok) {
      const { sentence } = (await res.json()) as { sentence?: unknown };
      if (typeof sentence === "string" && sentence.trim()) return sentence.trim().slice(0, 200);
    }
  } catch {
    // Offline, slow or no model: the template says the same thing.
  }
  return templateSentence(insight);
}

async function sendSwipe(projectId: string, op: SwipeOp): Promise<SendResult> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/swipes`;
  // keepalive: a swipe made just before navigating away still lands.
  const response =
    op.decision === null
      ? await fetch(`${url}?paperId=${encodeURIComponent(op.paperId)}`, {
          method: "DELETE",
          keepalive: true,
        })
      : await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            paperId: op.paperId,
            decision: op.decision,
          } satisfies SwipeRequest),
          keepalive: true,
        });
  return classifyStatus(response.status);
}

const shorten = (title: string) =>
  title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1).trimEnd()}…` : title;

/** Write queue for one project; failures become toasts with a Retry action. */
function createPersistence(projectId: string, titleOf: (paperId: string) => string | undefined) {
  let warnedSignedOut = false;
  // Latest op per paper: Retry on an older toast must never overwrite a newer decision.
  const latest = new Map<string, SwipeOp>();
  const toastId = (paperId: string) => `swipe-${paperId}`;

  const queue = createSwipeSync({
    send: (op) => sendSwipe(projectId, op),
    onFailure: (op, reason) => {
      if (reason === "unauthorised") {
        if (warnedSignedOut) return;
        warnedSignedOut = true;
        toast.info("You're not signed in, so swipes won't be kept.", {
          position: TOAST_POSITION,
        });
        return;
      }
      const title = titleOf(op.paperId);
      const what = title ? `“${shorten(title)}”` : "this paper";
      const verb = op.decision === null ? "undo your swipe on" : "save your swipe on";
      toast.error(`Couldn't ${verb} ${what}.`, {
        // One toast per paper: a later failure replaces the earlier one.
        id: toastId(op.paperId),
        position: TOAST_POSITION,
        // Stays until handled: keyboard and screen-reader users need time to reach Retry.
        duration: Infinity,
        actionButtonStyle: TOAST_BUTTON_STYLE,
        cancelButtonStyle: TOAST_BUTTON_STYLE,
        cancel: { label: "Dismiss", onClick: () => {} },
        action: {
          label: "Retry",
          onClick: () => {
            if (latest.get(op.paperId) === op) queue.enqueue(op);
          },
        },
      });
    },
  });

  return {
    push(op: SwipeOp) {
      latest.set(op.paperId, op);
      toast.dismiss(toastId(op.paperId));
      queue.enqueue(op);
    },
    /**
     * Before Start over: wait for writes still in flight (a late save would otherwise land after
     * the delete and bring that paper back), then make old failure toasts' Retry do nothing.
     */
    async settle(timeoutMs = 5000) {
      await Promise.race([queue.idle(), new Promise((r) => setTimeout(r, timeoutMs))]);
      for (const paperId of latest.keys()) toast.dismiss(toastId(paperId));
      latest.clear();
    },
  };
}

/**
 * SwipeDeck that saves every decision to Supabase (SW-05) and opens the detail sheet (SW-03).
 * Optimistic: the deck never waits; writes run in the background and a toast offers Retry.
 * Papers come from the queue (SW-04): searched, then analysed three ahead of the top card.
 */
export function PersistedSwipeDeck({
  projectId,
  query,
  swipedIds,
  claims,
  fallbackItems,
  libraryHref,
  initialHistory = NO_HISTORY,
  now,
}: {
  projectId: string;
  /** Search text for this project's papers. */
  query: string;
  /** Papers already decided on in earlier visits, so they never come back. */
  swipedIds: string[];
  /** Server request time (ISO), so year features match `initialHistory`'s. */
  now?: string;
  /** Swipes from earlier visits (oldest first), so the learnt order survives a reload (RK-02). */
  initialHistory?: SwipeSample[];
  claims: ProjectContext["claims"];
  /** Shown while /api/analyse isn't available yet (AI-04), so the demo deck never goes blank. */
  fallbackItems?: DeckItem[];
  libraryHref?: string;
}) {
  // RK-02: re-rank upcoming cards from this session's swipes (plus earlier ones). Undo pops.
  const [decisions, setDecisions] = useState<{ paperId: string; decision: SwipeDecision }[]>([]);
  const decidedIds = useMemo(
    () => new Set([...swipedIds, ...decisions.map((d) => d.paperId)]),
    [swipedIds, decisions],
  );

  // SW-04: fetch papers and analyse the next few before the user reaches them.
  const queue = usePaperQueue({ projectId, query, swipedIds, decidedIds });
  const items = useMemo(
    () => (queue.analyseUnavailable ? (fallbackItems ?? NO_ITEMS) : queue.items),
    [queue.analyseUnavailable, fallbackItems, queue.items],
  );

  // Titles for failure toasts; kept for papers that later leave `items`.
  const titles = useRef(new Map<string, string>());
  useEffect(() => {
    for (const item of items) titles.current.set(item.paper.id, item.paper.title);
  }, [items]);

  // Created on first swipe (event handlers only), one per mounted deck.
  const persist = useRef<ReturnType<typeof createPersistence> | null>(null);
  const enqueue = (op: SwipeOp) => {
    persist.current ??= createPersistence(projectId, (id) => titles.current.get(id));
    persist.current.push(op);
  };

  const features = useMemo(
    () =>
      new Map<string, PaperFeature[]>(
        items.map((i) => [
          i.paper.id,
          extractFeatures(i.paper, {
            credibility: i.credibility,
            now: now ? new Date(now) : undefined,
          }),
        ]),
      ),
    [items, now],
  );
  const featureIds = useMemo(
    () => new Map([...features].map(([id, list]) => [id, list.map((f) => f.id)])),
    [features],
  );
  const history = useMemo<SwipeSample[]>(
    () => [
      ...initialHistory,
      ...decisions.flatMap(({ paperId, decision }) => {
        const ids = featureIds.get(paperId);
        return ids ? [{ features: ids, decision }] : [];
      }),
    ],
    [initialHistory, decisions, featureIds],
  );
  // RK-03: filters applied from insight toasts sit on top of the learnt order.
  const filters = useDeckFilters(projectId);
  // A card brought back by Undo stays even if a filter would hide it, or Undo would seem to fail.
  const [undoneId, setUndoneId] = useState<string | null>(null);
  const ranked = useMemo(() => {
    const decided = new Set(decisions.map((d) => d.paperId));
    const idsOf = (i: DeckItem) => featureIds.get(i.paper.id) ?? [];
    return applyDeckFilters(
      rankItems(
        items.filter((i) => !decided.has(i.paper.id)),
        idsOf,
        history,
      ),
      (i) => (i.paper.id === undoneId ? [] : idsOf(i)),
      toDeckFilters(filters.active),
    );
  }, [items, featureIds, decisions, history, filters.active, undoneId]);

  // RK-03: after enough swipes, offer one clear pattern as a toast with a one-tap filter.
  // Earlier visits' swipes count, but only a swipe this visit can bring up a toast.
  const lastInsightAt = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      toast.dismiss(INSIGHT_TOAST_ID);
    };
  }, []);
  const { add: addFilter, remove: removeFilter } = filters;
  useEffect(() => {
    if (!decisions.length) return;
    if (lastInsightAt.current && decisions.length - lastInsightAt.current < INSIGHT_GAP) return;
    const skip = new Set([...offeredInsights(projectId), ...filters.active.map((f) => f.id)]);
    const upcoming = ranked.map((i) => features.get(i.paper.id) ?? []);
    const insight = findInsight(history, upcoming, { offered: skip });
    if (!insight) return;
    markOffered(projectId, insight.feature.id);
    lastInsightAt.current = decisions.length;

    const filter: ActiveFilter = {
      id: insight.feature.id,
      phrase: featurePhrase(insight.feature),
      mode: insight.direction === "skip" ? "hide" : "boost",
    };
    void insightSentence(projectId, insight).then((sentence) => {
      // Left the deck while the model was answering: don't follow them to the next page.
      if (!mounted.current) return;
      toast.info(sentence, {
        id: INSIGHT_TOAST_ID,
        position: TOAST_POSITION,
        classNames: INSIGHT_TOAST_CLASSES,
        // The live region reads the question; this says how to reach the answer.
        description: <span className="sr-only">Press Alt+T to answer.</span>,
        // Stays until handled: keyboard and screen-reader users need time to reach the action.
        duration: Infinity,
        actionButtonStyle: TOAST_BUTTON_STYLE,
        cancelButtonStyle: TOAST_BUTTON_STYLE,
        cancel: { label: "Not now", onClick: () => {} },
        action: {
          label: filter.mode === "hide" ? "Hide them" : "Show these first",
          onClick: () => {
            addFilter(filter);
            // Own id: reusing the insight's would let sonner close this one with it.
            toast.success(
              filter.mode === "hide"
                ? `Hiding ${filter.phrase}. Undo here or with the filter above the deck.`
                : `Showing ${filter.phrase} first. Undo here or with the filter above the deck.`,
              {
                id: `${INSIGHT_TOAST_ID}-applied`,
                position: TOAST_POSITION,
                duration: 10_000,
                classNames: INSIGHT_TOAST_CLASSES,
                actionButtonStyle: TOAST_BUTTON_STYLE,
                action: { label: "Undo", onClick: () => removeFilter(filter.id) },
              },
            );
            deck.current?.focus();
          },
        },
      });
    });
  }, [
    decisions.length,
    history,
    ranked,
    features,
    filters.active,
    projectId,
    addFilter,
    removeFilter,
  ]);

  const deck = useRef<SwipeDeckHandle>(null);
  // Start over: only offered once you've swiped here (this visit or before).
  const hasSwiped = swipedIds.length > 0 || decisions.length > 0;
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const [startingOver, setStartingOver] = useState(false);

  async function startOver() {
    if (startingOver) return;
    setStartingOver(true);
    try {
      await persist.current?.settle();
      const res = await fetch(`/api/projects/${projectId}/swipes?all=true`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      // A fresh load rebuilds the queue, ranking and history from nothing.
      window.location.reload();
    } catch {
      setStartingOver(false);
      toast.error("Couldn't start over. Try again.");
    }
  }
  // Item stays set while the sheet animates closed.
  const [details, setDetails] = useState<{ item: DeckItem; open: boolean } | null>(null);

  // AX-03: voice commands drive the same paths as the buttons and keys.
  function onVoice(command: VoiceCommand): boolean {
    const handle = deck.current;
    if (!handle) return false;
    const topId = handle.topId();
    const top = topId ? items.find((i) => i.paper.id === topId) : undefined;
    switch (command) {
      case "save":
      case "skip":
        return !!topId && handle.decide(topId, command);
      case "undo":
        return handle.undo();
      case "details":
        if (!topId) return false;
        handle.details();
        return true;
      case "read":
      case "why":
        if (!top) return false;
        speak(
          "voice",
          command === "read"
            ? cardScript({
                title: top.paper.title,
                whyItMatters: top.analysis.whyItMatters,
                overview: top.analysis.overview,
              })
            : [`Why it matters: ${top.analysis.whyItMatters.trim() || "not stated"}`],
        );
        return true;
      case "stop":
        stopSpeaking();
        return true;
    }
  }

  return (
    <>
      <VoiceControl onCommand={onVoice} />
      <FilterChips
        active={filters.active}
        onRemove={(filter) => {
          removeFilter(filter.id);
          toast(
            filter.mode === "hide"
              ? `Showing ${filter.phrase} again.`
              : `No longer showing ${filter.phrase} first.`,
            { position: TOAST_POSITION },
          );
        }}
        onEmpty={() => deck.current?.focus()}
      />
      <SwipeDeck
        ref={deck}
        items={ranked}
        claims={claims}
        libraryHref={libraryHref}
        loading={queue.loading}
        onLoadMore={queue.hasMore || queue.searchError ? queue.loadMore : undefined}
        onStartOver={hasSwiped ? () => setConfirmStartOver(true) : undefined}
        // Ranking history first: a failing save must not leave it out of step with the deck.
        onDecide={(paperId, decision) => {
          setUndoneId(null);
          setDecisions((d) => [...d, { paperId, decision }]);
          enqueue({ paperId, decision });
        }}
        onUndo={(paperId) => {
          setUndoneId(paperId);
          setDecisions((d) => (d.at(-1)?.paperId === paperId ? d.slice(0, -1) : d));
          enqueue({ paperId, decision: null });
        }}
        onDetails={(paperId) => {
          const item = items.find((i) => i.paper.id === paperId);
          if (item) setDetails({ item, open: true });
        }}
      />
      <Dialog
        open={confirmStartOver}
        onOpenChange={(open) => !startingOver && setConfirmStartOver(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start this deck over?</DialogTitle>
            <DialogDescription>
              Your saves and skips in this project are cleared, so your library here will be empty.
              Teammates&apos; votes stay as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 aria-disabled:opacity-70"
                aria-disabled={startingOver || undefined}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="min-h-11 aria-disabled:opacity-70"
              aria-disabled={startingOver || undefined}
              onClick={() => void startOver()}
            >
              {startingOver ? "Starting over…" : "Start over"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DetailSheet
        item={details?.item ?? null}
        claims={claims}
        open={details?.open ?? false}
        onOpenChange={(open) => setDetails((d) => (d ? { ...d, open } : d))}
        onDecide={(paperId, decision) => deck.current?.decide(paperId, decision) ?? false}
        onFocusDeck={() => deck.current?.focus()}
      />
    </>
  );
}

/** RK-03: what the insight filters are doing to the deck, each with a way to undo it. */
function FilterChips({
  active,
  onRemove,
  onEmpty,
}: {
  active: ActiveFilter[];
  onRemove: (filter: ActiveFilter) => void;
  /** Where focus goes when the last chip is removed. */
  onEmpty: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  if (!active.length) return null;
  // The focused button is about to unmount: move focus to a neighbour first.
  const remove = (filter: ActiveFilter, index: number) => {
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button");
    const next = buttons?.[index + 1] ?? buttons?.[index - 1];
    if (next) next.focus();
    else onEmpty();
    onRemove(filter);
  };
  return (
    <ul ref={list} aria-label="Deck filters" className="flex flex-wrap gap-2">
      {active.map((filter, index) => {
        const text = filter.mode === "hide" ? `Hiding ${filter.phrase}` : `${filter.phrase} first`;
        return (
          <li
            key={filter.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-card py-0.5 pr-0.5 pl-3 text-sm text-foreground hc:border-2"
          >
            <span className="min-w-0 break-words first-letter:uppercase">{text}</span>
            <button
              type="button"
              onClick={() => remove(filter, index)}
              className="relative inline-flex size-8 items-center justify-center rounded-full text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">
                {filter.mode === "hide"
                  ? `Show ${filter.phrase} again`
                  : `Stop showing ${filter.phrase} first`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
