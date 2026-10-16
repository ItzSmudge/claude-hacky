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
const offeredKey = (projectId: string) => `papercut:deck-insights-offered:${projectId}`;

function readStorage<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? schema.catch(fallback).parse(JSON.parse(raw)) : fallback;
  } catch {
    // Private mode, blocked storage or bad JSON.
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Still applies for this visit.
  }
}

function load(projectId: string): ActiveFilter[] {
  const known = memory.get(projectId);
  if (known) return known;
  const value = readStorage(storageKey(projectId), z.array(activeFilterSchema), NONE);
  memory.set(projectId, value);
  return value;
}

function save(projectId: string, value: ActiveFilter[]) {
  memory.set(projectId, value);
  writeStorage(storageKey(projectId), value);
  for (const listener of listeners) listener();
}

const offeredMemory = new Map<string, Set<string>>();

/** Feature ids already offered in an insight here, so a reload doesn't ask again. Client only. */
export function offeredInsights(projectId: string): Set<string> {
  let known = offeredMemory.get(projectId);
  if (!known) {
    known = new Set(readStorage(offeredKey(projectId), z.array(z.string()), []));
    offeredMemory.set(projectId, known);
  }
  return known;
}

export function markOffered(projectId: string, featureId: string) {
  const offered = offeredInsights(projectId);
  offered.add(featureId);
  writeStorage(offeredKey(projectId), [...offered]);
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
