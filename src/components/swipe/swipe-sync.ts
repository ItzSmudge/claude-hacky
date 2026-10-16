import type { SwipeDecision } from "@/types/domain";

/** Background write queue for swipes (SW-05). Pure — no React, no fetch — unit tested. */

/** `decision: null` means undo (delete the swipe). */
export interface SwipeOp {
  paperId: string;
  decision: SwipeDecision | null;
}

export type SendResult = "ok" | "retry" | "fail" | "unauthorised";
export type FailureReason = Exclude<SendResult, "ok">;

export function classifyStatus(status: number): SendResult {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401) return "unauthorised";
  if (status === 408 || status === 429 || status >= 500) return "retry";
  return "fail";
}

interface Slot {
  /** Latest op not yet sent; replaces any older one. */
  next: SwipeOp | null;
  /** Ends a backoff wait early when a newer op arrives. */
  wake?: () => void;
}

/**
 * One request in flight per paper; ops for the same paper queue behind it and collapse to the
 * latest. Different papers run in parallel. Transient failures retry after each delay in
 * `retryDelaysMs`; a failure is reported only if no newer op for that paper is waiting.
 */
export function createSwipeSync({
  send,
  onFailure,
  retryDelaysMs = [1000, 3000],
}: {
  send: (op: SwipeOp) => Promise<SendResult>;
  onFailure: (op: SwipeOp, reason: FailureReason) => void;
  retryDelaysMs?: number[];
}) {
  const slots = new Map<string, Slot>();
  // Resolved when nothing is in flight or waiting (Start over waits on this before deleting).
  let idleWaiters: (() => void)[] = [];

  async function attempt(op: SwipeOp): Promise<SendResult> {
    try {
      return await send(op);
    } catch {
      return "retry";
    }
  }

  async function drain(paperId: string, slot: Slot) {
    while (slot.next) {
      const op = slot.next;
      slot.next = null;

      let result = await attempt(op);
      for (const delay of retryDelaysMs) {
        if (result !== "retry" || slot.next) break;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          slot.wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        slot.wake = undefined;
        if (slot.next) break;
        result = await attempt(op);
      }

      if (result !== "ok" && !slot.next) {
        try {
          onFailure(op, result);
        } catch (error) {
          console.error("[swipe-sync] onFailure failed", error);
        }
      }
    }
    slots.delete(paperId);
    if (slots.size === 0) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  return {
    enqueue(op: SwipeOp) {
      const slot = slots.get(op.paperId);
      if (slot) {
        slot.next = op;
        slot.wake?.();
        return;
      }
      const fresh: Slot = { next: op };
      slots.set(op.paperId, fresh);
      void drain(op.paperId, fresh);
    },
    /** Papers with a write in flight or waiting. */
    pending: () => slots.size,
    /** Resolves once every queued write (including retries) has finished. */
    idle: (): Promise<void> =>
      slots.size === 0 ? Promise.resolve() : new Promise((resolve) => idleWaiters.push(resolve)),
  };
}
