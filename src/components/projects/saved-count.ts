// PR-04: the Library tab's count. Matches the library page, which lists each paper anyone saved once.

/** Distinct papers among a project's `decision = 'save'` swipe rows. */
export function countSaved(rows: readonly { paper_id: string }[] | null | undefined): number {
  return new Set(rows?.map((r) => r.paper_id)).size;
}

/** Fired on `window` with `{ projectId }` after this tab's own swipe write lands (save, skip or undo). */
export const SWIPES_CHANGED = "papercut:swipes-changed";

export function notifySwipesChanged(projectId: string) {
  window.dispatchEvent(new CustomEvent(SWIPES_CHANGED, { detail: { projectId } }));
}
