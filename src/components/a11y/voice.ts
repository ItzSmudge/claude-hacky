// AX-03: what a spoken phrase means for the deck. Pure, so it's tested without a microphone.

export type VoiceCommand = "save" | "skip" | "undo" | "read" | "why" | "details" | "stop";

/** Phrases per command, longest first within each so "go back" beats "back". */
const PHRASES: [VoiceCommand, string[]][] = [
  ["why", ["why does it matter", "why it matters", "why"]],
  ["undo", ["go back", "undo", "back"]],
  ["details", ["show more", "details", "more"]],
  ["read", ["read it out", "read it", "read", "listen"]],
  ["stop", ["be quiet", "stop", "quiet"]],
  ["save", ["save it", "save", "keep", "yes"]],
  ["skip", ["next one", "skip", "pass", "next", "no"]],
];

/**
 * The last command spoken in `heard` (people correct themselves: "skip, no wait, save"), matched
 * on whole words only, so "saved" or "skipping" in normal speech don't act. Null if none.
 */
export function matchCommand(heard: string): VoiceCommand | null {
  const text = ` ${heard
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  if (text.trim() === "") return null;
  let best: { command: VoiceCommand; at: number; length: number } | null = null;
  for (const [command, phrases] of PHRASES) {
    for (const phrase of phrases) {
      const at = text.lastIndexOf(` ${phrase} `);
      if (at === -1) continue;
      // Later wins; at the same end position, the longer phrase wins ("why does it matter").
      const end = at + phrase.length;
      const bestEnd = best ? best.at + best.length : -1;
      if (!best || end > bestEnd || (end === bestEnd && phrase.length > best.length)) {
        best = { command, at, length: phrase.length };
      }
    }
  }
  return best?.command ?? null;
}

export const VOICE_HELP = "Say save, skip, undo, read, why, details or stop.";
