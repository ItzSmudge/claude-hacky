"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SwipeRequest } from "@/lib/api-schemas";
import type { ProjectContext } from "@/types/domain";
import { DetailSheet } from "./detail-sheet";
import { SwipeDeck, type DeckItem, type SwipeDeckHandle } from "./swipe-deck";
import { classifyStatus, createSwipeSync, type SendResult, type SwipeOp } from "./swipe-sync";

const TITLE_MAX = 60;
/** Top so a toast never covers the deck controls on a phone. */
const TOAST_POSITION = "top-center";
/** sonner's buttons are 24px tall; inline style beats its stylesheet. */
const TOAST_BUTTON_STYLE = { minHeight: 44, height: "auto", paddingInline: 16 };

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

  return (op: SwipeOp) => {
    latest.set(op.paperId, op);
    toast.dismiss(toastId(op.paperId));
    queue.enqueue(op);
  };
}

/**
 * SwipeDeck that saves every decision to Supabase (SW-05) and opens the detail sheet (SW-03).
 * Optimistic: the deck never waits; writes run in the background and a toast offers Retry.
 */
export function PersistedSwipeDeck({
  projectId,
  items,
  claims,
  libraryHref,
}: {
  projectId: string;
  items: DeckItem[];
  claims: ProjectContext["claims"];
  libraryHref?: string;
}) {
  // Titles for failure toasts; kept for papers that later leave `items`.
  const titles = useRef(new Map<string, string>());
  useEffect(() => {
    for (const item of items) titles.current.set(item.paper.id, item.paper.title);
  }, [items]);

  // Created on first swipe (event handlers only), one per mounted deck.
  const persist = useRef<ReturnType<typeof createPersistence> | null>(null);
  const enqueue = (op: SwipeOp) => {
    persist.current ??= createPersistence(projectId, (id) => titles.current.get(id));
    persist.current(op);
  };

  const deck = useRef<SwipeDeckHandle>(null);
  // Item stays set while the sheet animates closed.
  const [details, setDetails] = useState<{ item: DeckItem; open: boolean } | null>(null);

  return (
    <>
      <SwipeDeck
        ref={deck}
        items={items}
        claims={claims}
        libraryHref={libraryHref}
        onDecide={(paperId, decision) => enqueue({ paperId, decision })}
        onUndo={(paperId) => enqueue({ paperId, decision: null })}
        onDetails={(paperId) => {
          const item = items.find((i) => i.paper.id === paperId);
          if (item) setDetails({ item, open: true });
        }}
      />
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
