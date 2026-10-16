// PR-04: the Library tab's count. Matches the library page, which lists each paper anyone saved once.

/** Distinct papers among a project's `decision = 'save'` swipe rows. */
export function countSaved(rows: readonly { paper_id: string }[] | null | undefined): number {
  return new Set(rows?.map((r) => r.paper_id)).size;
}
