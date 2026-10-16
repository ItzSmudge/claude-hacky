"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { VOICE_HELP, matchCommand, type VoiceCommand } from "./voice";

/** The parts of the Web Speech recognition API we use (Chrome/Edge/Safari prefix it). */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};
const DONE: Record<VoiceCommand, string> = {
  save: "Saved",
  skip: "Skipped",
  undo: "Undone",
  read: "Reading",
  why: "Why it matters",
  details: "Details",
  stop: "Stopped",
};

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden hc:focus-visible:ring-4";

/**
 * AX-03: hands-free swiping. A microphone toggle above the deck; while on, the browser's speech
 * recognition listens and each recognised phrase runs one command. Hidden where unsupported
 * (e.g. Firefox). Audio is processed by the browser's own service, never by PaperCut.
 */
export function VoiceControl({
  onCommand,
  disabled = false,
}: {
  /** Returns false when the command couldn't run (e.g. no card to save). */
  onCommand: (command: VoiceCommand) => boolean;
  disabled?: boolean;
}) {
  const supported = useSyncExternalStore(
    noop,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognition = useRef<Recognition | null>(null);
  // Whether the user wants it on: browsers end sessions after silence, so we restart.
  const wanted = useRef(false);

  // The latest handler, read when a phrase arrives (the recognition object outlives renders).
  const latest = useRef(onCommand);
  useEffect(() => {
    latest.current = onCommand;
  }, [onCommand]);

  function handle(heard: string) {
    const command = matchCommand(heard);
    // Read-aloud is playing: the microphone may be hearing our own voice, so only "stop" counts.
    if (window.speechSynthesis?.speaking && command !== "stop") return;
    if (!command) {
      setStatus(`Didn't catch a command in “${heard.trim()}”. ${VOICE_HELP}`);
      return;
    }
    const ran = latest.current(command);
    setStatus(ran ? `${DONE[command]}.` : `Couldn't ${command} right now.`);
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript;
        if (transcript) handle(transcript);
      }
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wanted.current = false;
        setListening(false);
        setStatus("Microphone access was blocked. Allow it in your browser settings to use voice.");
      }
      // "no-speech" / "aborted" / network blips: onend restarts if still wanted.
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          // Fall through: couldn't restart.
        }
      }
      setListening(false);
    };
    recognition.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
      setStatus(`Listening. ${VOICE_HELP}`);
    } catch {
      wanted.current = false;
      setStatus("Couldn't start the microphone. Try again.");
    }
  }

  function stopListening() {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setStatus("Voice control off.");
  }

  // Leaving the page turns the microphone off.
  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.stop();
    },
    [],
  );

  if (!supported) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => (listening ? stopListening() : start())}
        disabled={disabled && !listening}
        aria-pressed={listening}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50",
          listening
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted hc:border-2",
          RING,
        )}
      >
        {listening ? (
          <Mic className="size-4 motion-safe:animate-pulse" strokeWidth={1.75} aria-hidden />
        ) : (
          <MicOff className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        Voice control
      </button>
      <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm text-muted-foreground">
        {status || (listening ? "" : "Swipe hands-free: say save, skip or read.")}
      </p>
    </div>
  );
}
