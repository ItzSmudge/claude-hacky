// AX-03: what a spoken phrase means for the deck. Pure, so it's tested without a microphone.

export type VoiceCommand = "save" | "skip" | "undo" | "read" | "why" | "details" | "stop";

/**
 * Whole utterances only. Single everyday words ("yes", "no", "next", "more", "back") are left out
 * on purpose: in a group demo, or with a screen reader on the speakers, they come up in normal
 * speech and would act on cards nobody meant to touch.
 */
const PHRASES: Record<string, VoiceCommand> = {
  save: "save",
  "save it": "save",
  "save this": "save",
  skip: "skip",
  "skip it": "skip",
  "skip this": "skip",
  undo: "undo",
  "go back": "undo",
  read: "read",
  "read it": "read",
  "read it out": "read",
  "read this": "read",
  listen: "read",
  why: "why",
  "why it matters": "why",
  "why does it matter": "why",
  details: "details",
  "show details": "details",
  "more details": "details",
  stop: "stop",
  "stop reading": "stop",
};

/** Politeness and hesitation people wrap commands in: "um, save please". */
const FILLER = new Set([
  "um",
  "uh",
  "er",
  "erm",
  "please",
  "ok",
  "okay",
  "now",
  "the",
  "card",
  "paper",
]);

/**
 * The command if the whole utterance is one (after dropping filler words), else null. So "save"
 * and "um, save it please" act, but "I'd save that one" or "saved paper" don't.
 */
export function matchCommand(heard: string): VoiceCommand | null {
  const words = heard
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));
  if (words.length === 0 || words.length > 4) return null;
  return PHRASES[words.join(" ")] ?? null;
}

export const VOICE_COMMANDS = "save · skip · undo · read · why · details · stop";
