"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { RATES, nextRate, rateLabel, toUtterances, type Rate } from "./speech";

// ── One shared player: only one Listen button speaks at a time, page-wide ─────────────────
let speakingId: string | null = null;
// Each playback gets a token: WebKit fires `end` (not `error`) on utterances removed by cancel(),
// so a restart at a new speed must not be stopped by the old queue's last `end`.
let session = 0;
let rate: Rate = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const RATE_KEY = "papercut:read-aloud-rate";
let rateLoaded = false;

function loadRate() {
  if (rateLoaded) return;
  rateLoaded = true;
  try {
    const saved = Number(window.localStorage.getItem(RATE_KEY));
    if ((RATES as readonly number[]).includes(saved)) rate = saved as Rate;
  } catch {
    // Storage blocked (private mode): stay at 1×.
  }
}

const synth = () =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

function speak(id: string, parts: readonly string[]) {
  const s = synth();
  if (!s) return;
  s.cancel();
  const mine = ++session;
  speakingId = id;
  emit();
  const chunks = toUtterances(parts);
  chunks.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.lang = "en-GB";
    if (i === chunks.length - 1) {
      u.onend = () => {
        if (session === mine) stop();
      };
    }
    // cancel() fires "interrupted"/"canceled" on the old queue: only real failures reset us.
    u.onerror = (e) => {
      if (session === mine && e.error !== "interrupted" && e.error !== "canceled") stop();
    };
    // Queued synchronously inside the click, which iOS Safari needs to allow speech.
    s.speak(u);
  });
}

function stop() {
  synth()?.cancel();
  if (speakingId !== null) {
    speakingId = null;
    emit();
  }
}

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden hc:focus-visible:ring-4";

/**
 * AX-02: Listen / Stop plus a speed button (0.75×–1.5×, remembered on this device). Hidden where
 * the browser has no speech synthesis. Stops when unmounted, e.g. when the card is swiped away.
 */
export function ReadAloud({
  parts,
  what,
  className,
  ringOffset = "focus-visible:ring-offset-card",
}: {
  /** Text to read, in order (sentences are split automatically). */
  parts: readonly string[];
  /** Accessible name suffix: "Listen to <what>". */
  what: string;
  className?: string;
  ringOffset?: string;
}) {
  const id = useId();
  const supported = useSyncExternalStore(
    subscribe,
    () => synth() !== null,
    () => false,
  );
  const speaking = useSyncExternalStore(
    subscribe,
    () => speakingId === id,
    () => false,
  );
  const currentRate = useSyncExternalStore(
    subscribe,
    () => rate,
    () => 1 as Rate,
  );
  // The remembered speed, once, after hydration.
  useEffect(() => {
    if (!rateLoaded) {
      loadRate();
      emit();
    }
  }, []);

  // Swiped away or closed: don't keep talking about a paper that's gone.
  useEffect(
    () => () => {
      if (speakingId === id) stop();
    },
    [id],
  );

  if (!supported) return null;

  function changeRate() {
    rate = nextRate(rate);
    try {
      window.localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // Not remembered this time; still applies now.
    }
    emit();
    // Restart at the new speed so the change is heard straight away.
    if (speakingId === id) speak(id, parts);
  }

  return (
    <div role="group" aria-label="Read aloud" className={cn("flex items-center gap-1", className)}>
      <span className="sr-only">
        Uses your device&apos;s voice, which may overlap your screen reader.
      </span>
      <button
        type="button"
        onClick={() => (speaking ? stop() : speak(id, parts))}
        aria-label={speaking ? `Stop reading ${what}` : `Listen to ${what}`}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-primary transition-colors hover:bg-muted",
          RING,
          ringOffset,
        )}
      >
        {speaking ? (
          <Square className="size-4 fill-current" strokeWidth={1.75} aria-hidden />
        ) : (
          <Volume2 className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        <span aria-hidden>{speaking ? "Stop" : "Listen"}</span>
      </button>
      <button
        type="button"
        onClick={changeRate}
        aria-label={`Reading speed ${rateLabel(currentRate)}. Change speed`}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 text-sm font-medium text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground",
          RING,
          ringOffset,
        )}
      >
        {rateLabel(currentRate)}
      </button>
    </div>
  );
}
