import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";
import type { DeckFilters } from "@/lib/ranking";

/**
 * RK-03: the deck filters a person applied from insight toasts, per project. Kept in memory and
 * mirrored to localStorage so they survive a reload; storage failing only loses that.
 */

const activeFilterSchema = z.object({
  id: z.string().min(1),
  /** Short phrase for the chip, e.g. "reviews" or "papers on Social Media Use". */
  phrase: z.string().min(1),
  mode: z.enum(["hide", "boost"]),
});
export type ActiveFilter = z.infer<typeof activeFilterSchema>;

const NONE: ActiveFilter[] = [];
const memory = new Map<string, ActiveFilter[]>();
const listeners = new Set<() => void>();
const storageKey = (projectId: string) => `papercut:deck-filters:${projectId}`;

function load(projectId: string): ActiveFilter[] {
  const known = memory.get(projectId);
  if (known) return known;
  let value = NONE;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (raw) value = z.array(activeFilterSchema).catch(NONE).parse(JSON.parse(raw));
  } catch {
    // Private mode, blocked storage or bad JSON: start with no filters.
  }
  memory.set(projectId, value);
  return value;
}

function save(projectId: string, value: ActiveFilter[]) {
  memory.set(projectId, value);
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(value));
  } catch {
    // Still applies for this visit.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Pure. The ids `applyDeckFilters` needs. */
export function toDeckFilters(active: readonly ActiveFilter[]): DeckFilters {
  return {
    hide: active.filter((f) => f.mode === "hide").map((f) => f.id),
    boost: active.filter((f) => f.mode === "boost").map((f) => f.id),
  };
}

export function useDeckFilters(projectId: string) {
  const active = useSyncExternalStore(
    subscribe,
    () => load(projectId),
    () => NONE,
  );
  const add = useCallback(
    (filter: ActiveFilter) =>
      save(projectId, [...load(projectId).filter((f) => f.id !== filter.id), filter]),
    [projectId],
  );
  const remove = useCallback(
    (id: string) =>
      save(
        projectId,
        load(projectId).filter((f) => f.id !== id),
      ),
    [projectId],
  );
  return { active, add, remove };
}
