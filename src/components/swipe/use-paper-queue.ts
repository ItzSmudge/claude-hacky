"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { searchResponseSchema, type SearchResponse } from "@/lib/api-schemas";
import type { PaperAnalysis } from "@/types/domain";
import { streamAnalyses } from "./analyse-stream";
import { AHEAD, idsToAnalyse } from "./queue-state";
import type { DeckItem } from "./swipe-deck";

type Candidate = SearchResponse["papers"][number];

export function usePaperQueue({
  projectId,
  query,
  swipedIds,
  decidedIds,
}: {
  projectId: string;
  query: string;
  swipedIds: string[];
  decidedIds: ReadonlySet<string>;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, PaperAnalysis>>({});
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const inflight = useRef(new Set<string>());
  const fetchingPage = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const swiped = useMemo(() => new Set(swipedIds), [swipedIds]);

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (nextPage === null || fetchingPage.current) return;
    fetchingPage.current = true;
    setSearching(true);
    setSearchError(false);
    try {
      const params = new URLSearchParams({ q: query, projectId, page: String(nextPage) });
      const response = await fetch(`/api/search?${params}`, { signal: abort.current?.signal });
      if (!response.ok) throw new Error(String(response.status));
      const data = searchResponseSchema.parse(await response.json());
      setCandidates((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...data.papers.filter((p) => !seen.has(p.id) && !swiped.has(p.id))];
      });
      setNextPage(data.nextPage);
    } catch {
      if (!abort.current?.signal.aborted) setSearchError(true);
    } finally {
      fetchingPage.current = false;
      setSearching(false);
    }
  }, [nextPage, query, projectId, swiped]);

  const undecided = useMemo(
    () => candidates.filter((c) => !decidedIds.has(c.id) && !failed.has(c.id)),
    [candidates, decidedIds, failed],
  );

  // Prefetch the next page of results before the deck runs dry.
  useEffect(() => {
    if (undecided.length < AHEAD * 2 && nextPage !== null && !searchError) void loadMore();
  }, [undecided.length, nextPage, searchError, loadMore]);

  // Analyse the top card plus three behind it; results arrive one by one.
  useEffect(() => {
    const ids = idsToAnalyse({
      candidates,
      analysed: analyses,
      inflight: inflight.current,
      failed,
      decided: decidedIds,
    });
    if (ids.length === 0) return;
    for (const id of ids) inflight.current.add(id);
    const signal = abort.current?.signal;
    const settled = new Set<string>();

    void (async () => {
      try {
        await streamAnalyses(
          { projectId, paperIds: ids },
          (event) => {
            if (event.type === "analysis") {
              settled.add(event.analysis.paperId);
              setAnalyses((a) => ({ ...a, [event.analysis.paperId]: event.analysis }));
            } else if (event.type === "error") {
              settled.add(event.paperId);
              setFailed((f) => new Set(f).add(event.paperId));
            }
          },
          signal,
        );
      } catch {
        // fall through: anything unsettled is marked failed below
      } finally {
        if (!signal?.aborted) {
          const missing = ids.filter((id) => !settled.has(id));
          if (missing.length) setFailed((f) => new Set([...f, ...missing]));
        }
        for (const id of ids) inflight.current.delete(id);
        bump();
      }
    })();
  }, [candidates, analyses, failed, decidedIds, projectId]);

  const items = useMemo<DeckItem[]>(
    () =>
      candidates.flatMap(({ credibility, ...paper }) => {
        const analysis = analyses[paper.id];
        return analysis ? [{ paper, analysis, credibility }] : [];
      }),
    [candidates, analyses],
  );

  const waitingOnAnalysis = undecided.some((c) => !analyses[c.id]);
  const loading = (searching && undecided.length === 0) || waitingOnAnalysis;

  return {
    items,
    loading,
    hasMore: nextPage !== null,
    searchError,
    loadMore: () => void loadMore(),
  };
}
