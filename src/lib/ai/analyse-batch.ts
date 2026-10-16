import Anthropic from "@anthropic-ai/sdk";
import { paperAnalysisSchema, type AnalyseStreamEvent } from "@/lib/api-schemas";
import type { Paper, PaperAnalysis } from "@/types/domain";
import { AiConfigError, AiOutputError, AiRefusalError } from "./errors";

/**
 * AI-04: turn a batch of paper ids into a stream of events for the deck. Saved analyses go out
 * first; the rest are analysed `concurrency` at a time and emitted as each one settles, so a
 * slow paper never holds up the others. I/O is injected so this is testable without a DB or key.
 */

export interface AnalyseBatchDeps {
  /** Rows already in `paper_analyses` for this project (unvalidated JSON). */
  loadExisting(paperIds: string[]): Promise<{ paperId: string; analysis: unknown }[]>;
  /** Cached `Paper`s for these ids; ids not in the cache are simply absent. */
  loadPapers(paperIds: string[]): Promise<Paper[]>;
  analyse(paper: Paper, signal: AbortSignal): Promise<PaperAnalysis>;
  save(paper: Paper, analysis: PaperAnalysis): Promise<void>;
}

export interface AnalyseBatchInput {
  projectId: string;
  paperIds: string[];
  deps: AnalyseBatchDeps;
  signal?: AbortSignal;
  concurrency?: number;
}

const SUMMARY_FAILED = "Couldn't summarise this paper";
const BUSY = "AI is busy — try again";
const NOT_CONFIGURED = "AI isn't configured";
const FAILED = "Analysis failed";

/** Short user-facing text per failure class; details go to the server log only. */
function messageFor(error: unknown, aborted: boolean): string {
  if (error instanceof AiOutputError || error instanceof AiRefusalError) return SUMMARY_FAILED;
  if (error instanceof AiConfigError) return NOT_CONFIGURED;
  if (
    aborted ||
    error instanceof Anthropic.APIConnectionError || // includes timeouts
    error instanceof Anthropic.APIUserAbortError ||
    error instanceof Anthropic.RateLimitError ||
    (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)
  )
    return BUSY;
  return FAILED;
}

const errorEvent = (paperId: string, error: string): AnalyseStreamEvent => ({
  type: "error",
  paperId,
  error,
});

export async function* analyseBatch({
  projectId,
  paperIds,
  deps,
  signal = new AbortController().signal,
  concurrency = 5,
}: AnalyseBatchInput): AsyncGenerator<AnalyseStreamEvent> {
  const ids = [...new Set(paperIds)];

  // 1. Saved analyses: instant, no model call. Invalid or foreign rows are redone.
  const existing = await deps.loadExisting(ids).catch((error: unknown) => {
    console.error("[analyse] loading saved analyses failed", error);
    return [];
  });
  const done = new Set<string>();
  for (const row of existing) {
    const parsed = paperAnalysisSchema.safeParse(row.analysis);
    if (!parsed.success || done.has(row.paperId) || !ids.includes(row.paperId)) continue;
    if (parsed.data.paperId !== row.paperId || parsed.data.projectId !== projectId) continue;
    done.add(row.paperId);
    yield { type: "analysis", analysis: parsed.data };
  }

  // 2. Cached papers for the rest.
  const todo = ids.filter((id) => !done.has(id));
  let papers: Paper[] = [];
  if (todo.length) {
    try {
      papers = await deps.loadPapers(todo);
    } catch (error) {
      console.error("[analyse] loading papers failed", error);
      for (const id of todo) yield errorEvent(id, FAILED);
      yield { type: "done" };
      return;
    }
  }
  const byId = new Map(papers.map((paper) => [paper.id, paper]));
  for (const id of todo) if (!byId.has(id)) yield errorEvent(id, "Paper not found");

  // 3. Analyse in a pool; never rejects, so one failure can't stop the stream.
  const saves: Promise<void>[] = [];
  let configLogged = false;
  const run = async (paper: Paper): Promise<AnalyseStreamEvent> => {
    if (signal.aborted) return errorEvent(paper.id, BUSY);
    try {
      const analysis = await deps.analyse(paper, signal);
      saves.push(
        deps.save(paper, analysis).catch((error: unknown) => {
          console.error("[analyse] saving analysis failed", paper.id, error);
        }),
      );
      return { type: "analysis", analysis };
    } catch (error) {
      const message = messageFor(error, signal.aborted);
      if (message === NOT_CONFIGURED) {
        if (!configLogged) console.error("[analyse] AI is not configured");
        configLogged = true;
      } else if (message !== BUSY) {
        const name = error instanceof Error ? error.name : typeof error;
        console.error("[analyse] analysis failed", paper.id, name);
      }
      return errorEvent(paper.id, message);
    }
  };

  const queue = todo.flatMap((id) => byId.get(id) ?? []);
  const inFlight = new Map<string, Promise<{ id: string; event: AnalyseStreamEvent }>>();
  while (queue.length || inFlight.size) {
    while (inFlight.size < concurrency && queue.length) {
      const paper = queue.shift()!;
      inFlight.set(
        paper.id,
        run(paper).then((event) => ({ id: paper.id, event })),
      );
    }
    const { id, event } = await Promise.race(inFlight.values());
    inFlight.delete(id);
    yield event;
  }

  // Serverless functions may stop once the response ends: finish writes before `done`.
  await Promise.all(saves);
  yield { type: "done" };
}
