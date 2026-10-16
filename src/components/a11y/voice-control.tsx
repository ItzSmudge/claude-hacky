"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { VOICE_COMMANDS, matchCommand, type VoiceCommand } from "./voice";

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
  abort: () => void;
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
/** Errors that won't fix themselves by listening again. */
const FATAL: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser settings to use voice.",
  "service-not-allowed": "Voice isn't available in this browser.",
  "audio-capture": "No microphone found.",
  "language-not-supported": "Voice isn't available in this language here.",
  network: "Voice needs an internet connection. Turned off.",
};
/** After our own read-aloud stops, its last words can still arrive as a result: ignore them. */
const ECHO_MS = 1500;
const RESTART_MS = 300;
/** Sessions that end within this time count as failures; three in a row and we give up. */
const QUICK_FAIL_MS = 1000;

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden hc:focus-visible:ring-4";

/**
 * AX-03: hands-free swiping. A microphone toggle above the deck; while on, the browser's speech
 * recognition listens and a short spoken command acts on the top card. Hidden where unsupported
 * (e.g. Firefox). Audio is processed by the browser's own service, never by PaperCut.
 */
export function VoiceControl({
  onCommand,
}: {
  /** Returns false when the command couldn't run (e.g. nothing to undo). */
  onCommand: (command: VoiceCommand) => boolean;
}) {
  const hintId = useId();
  const supported = useSyncExternalStore(
    noop,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  // Announced (polite): only outcomes the deck doesn't announce itself.
  const [status, setStatus] = useState("");
  // Shown, not announced: what was last heard, so stray room talk isn't read back.
  const [heard, setHeard] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const lastSpeech = useRef(0);

  // The latest handler, read when a phrase arrives (the recogniser outlives renders).
  const latest = useRef(onCommand);
  useEffect(() => {
    latest.current = onCommand;
  }, [onCommand]);

  // While listening, note when read-aloud last played, to ignore its echo.
  useEffect(() => {
    if (!listening) return;
    const timer = setInterval(() => {
      if (window.speechSynthesis?.speaking) lastSpeech.current = Date.now();
    }, 200);
    return () => clearInterval(timer);
  }, [listening]);

  function handle(transcript: string) {
    if (window.speechSynthesis?.speaking) lastSpeech.current = Date.now();
    const command = matchCommand(transcript);
    // Hearing our own voice (or its tail end): only "stop" counts.
    if (Date.now() - lastSpeech.current < ECHO_MS && command !== "stop") return;
    if (!command) {
      setHeard(transcript.trim());
      return;
    }
    setHeard("");
    const ran = latest.current(command);
    if (!ran) setStatus(`Couldn't ${command} right now.`);
    // The deck announces save/skip/undo/details itself; only say what it doesn't.
    else if (command === "read" || command === "why") setStatus("Reading.");
    else if (command === "stop") setStatus("Stopped reading.");
    else setStatus("");
  }

  function turnOff(message: string) {
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onresult = r.onerror = r.onend = null;
      r.abort();
    }
    setListening(false);
    setHeard("");
    setStatus(message);
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = false;
    let startedAt = 0;
    let quickFails = 0;
    const begin = () => {
      startedAt = Date.now();
      r.start();
    };
    // Every handler checks it's still the active recogniser: a stopped one can still fire.
    r.onresult = (event) => {
      if (recognition.current !== r) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript;
        if (transcript) handle(transcript);
      }
    };
    r.onerror = (event) => {
      if (recognition.current !== r) return;
      const fatal = FATAL[event.error];
      if (fatal) turnOff(fatal);
      // "no-speech" / "aborted": onend restarts below.
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      // Browsers end sessions after silence; restart, unless they keep ending at once.
      quickFails = Date.now() - startedAt < QUICK_FAIL_MS ? quickFails + 1 : 0;
      if (quickFails >= 3) return turnOff("Voice stopped. Turn it on again to retry.");
      setTimeout(() => {
        if (recognition.current !== r) return;
        try {
          begin();
        } catch {
          turnOff("Voice stopped. Turn it on again to retry.");
        }
      }, RESTART_MS);
    };
    recognition.current = r;
    try {
      begin();
      setListening(true);
      setStatus("Listening.");
    } catch {
      recognition.current = null;
      setStatus("Couldn't start the microphone. Try again.");
    }
  }

  // Leaving the page turns the microphone off.
  useEffect(
    () => () => {
      const r = recognition.current;
      recognition.current = null;
      if (r) {
        r.onresult = r.onerror = r.onend = null;
        r.abort();
      }
    },
    [],
  );

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => (listening ? turnOff("Voice control off.") : start())}
          aria-pressed={listening}
          aria-describedby={hintId}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
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
        <p id={hintId} className="min-w-0 flex-1 text-sm text-muted-foreground">
          Say: {VOICE_COMMANDS}. Works best with headphones.
        </p>
      </div>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {status}
      </p>
      {heard && (
        <p className="text-sm text-muted-foreground">
          Heard “{heard}”, which isn&apos;t a command.
        </p>
      )}
    </div>
  );
}
