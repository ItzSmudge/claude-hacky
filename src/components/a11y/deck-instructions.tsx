/**
 * How to drive the deck, for screen-reader users (the on-screen key hints are hidden from them
 * and on phones). Visually hidden but in reading order, just before the deck; also link it with
 * `aria-describedby` so it is read the first time the deck takes focus. Plain text only.
 */
export function DeckInstructions({ id, details }: { id: string; details: boolean }) {
  return (
    <p id={id} className="sr-only">
      Use the Skip, Undo and Save buttons after the card. With a keyboard: right arrow saves, left
      arrow skips{details ? ", up arrow opens details" : ""} and Z undoes.
    </p>
  );
}
