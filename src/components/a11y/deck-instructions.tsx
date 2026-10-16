/**
 * How to drive the deck, for screen-reader users (the on-screen key hints are hidden from them
 * and on phones). Link it with `aria-describedby` so it is read when the deck takes focus.
 */
export function DeckInstructions({ id, details }: { id: string; details: boolean }) {
  return (
    <p id={id} hidden>
      Right arrow saves, left arrow skips{details ? ", up arrow opens details" : ""} and Z undoes.
      Or use the Skip, Undo and Save buttons after the card.
    </p>
  );
}
