// AX-02: turning card text into speech-sized pieces. Pure, so it's tested without a browser.

export const RATES = [0.75, 1, 1.25, 1.5] as const;
export type Rate = (typeof RATES)[number];

/** The next speed in the cycle; anything unknown goes back to 1×. */
export function nextRate(rate: number): Rate {
  const i = RATES.indexOf(rate as Rate);
  return i === -1 ? 1 : RATES[(i + 1) % RATES.length];
}

export const rateLabel = (rate: number) => `${rate}×`;

/** Chrome silently stops utterances after ~15 s, so speak in sentence-sized pieces. */
const MAX_CHUNK = 220;

/**
 * Sentences (split after . ! ? followed by a space), with very long ones broken on word
 * boundaries. "2.5" stays together because there's no space after the dot.
 */
export function toUtterances(parts: readonly string[], max = MAX_CHUNK): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const text = part.replace(/\s+/g, " ").trim();
    if (!text) continue;
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= max) {
        out.push(sentence);
        continue;
      }
      let chunk = "";
      for (const word of sentence.split(" ")) {
        if (chunk && chunk.length + 1 + word.length > max) {
          out.push(chunk);
          chunk = word;
        } else {
          chunk = chunk ? `${chunk} ${word}` : word;
        }
      }
      if (chunk) out.push(chunk);
    }
  }
  return out;
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** What the card's Listen button reads: title, why it matters, overview. */
export function cardScript({
  title,
  whyItMatters,
  overview,
}: {
  title: string;
  whyItMatters: string;
  overview: string;
}): string[] {
  return [
    sentence(title.trim()),
    whyItMatters.trim() && `Why it matters: ${sentence(whyItMatters.trim())}`,
    overview.trim(),
  ].filter(Boolean);
}
