"use client";

import { useCallback, useState } from "react";

// Live regions only speak when their text changes: alternate a trailing no-break space so the
// same message (Skip → Undo → Skip on one paper) is still read the second time.
const NBSP = " ";

/** `announce(text)` sends a message to the polite live region rendered by `<LiveAnnouncer>`. */
export function useAnnouncer() {
  const [message, setMessage] = useState({ text: "", count: 0 });
  const announce = useCallback(
    (text: string) => setMessage((m) => ({ text, count: m.count + 1 })),
    [],
  );
  return { message: message.text + (message.count % 2 ? NBSP : ""), announce };
}

/** Visually hidden, polite, read as a whole. Keep it mounted so the first message is heard. */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
