import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import type { AnalyseStreamEvent } from "@/lib/api-schemas";
import type { Paper, PaperAnalysis } from "@/types/domain";
import { analyseBatch, type AnalyseBatchDeps } from "./analyse-batch";
import { AiConfigError, AiOutputError, AiRefusalError } from "./errors";

const projectId = fixtureProject.id;
const papers = fixturePapers.map((f) => f.paper);
const analysisOf = (paper: Paper): PaperAnalysis =>
  fixturePapers.find((f) => f.paper.id === paper.id)!.analysis;

/** Resolves after `ms` of fake time, or rejects when the signal aborts. */
const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

function deps(overrides: Partial<AnalyseBatchDeps> = {}): AnalyseBatchDeps {
  return {
    loadExisting: vi.fn(async () => []),
    loadPapers: vi.fn(async (ids: string[]) => papers.filter((p) => ids.includes(p.id))),
    analyse: vi.fn(async (paper: Paper) => analysisOf(paper)),
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

async function collect(iterable: AsyncIterable<AnalyseStreamEvent>) {
  const events: AnalyseStreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

const idOf = (e: AnalyseStreamEvent) =>
  e.type === "analysis" ? e.analysis.paperId : e.type === "error" ? e.paperId : "done";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("analyseBatch", () => {
  it("analyses each paper, saves it, and ends with done", async () => {
    const d = deps();
    const ids = papers.slice(0, 3).map((p) => p.id);
    const events = await collect(analyseBatch({ projectId, paperIds: ids, deps: d }));
    expect(events.map(idOf).sort()).toEqual([...ids, "done"].sort());
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(d.save).toHaveBeenCalledTimes(3);
    expect(d.save).toHaveBeenCalledWith(papers[0], analysisOf(papers[0]!));
  });

  it("dedupes paper ids", async () => {
    const d = deps();
    const id = papers[0]!.id;
    const events = await collect(analyseBatch({ projectId, paperIds: [id, id], deps: d }));
    expect(events).toHaveLength(2);
    expect(d.analyse).toHaveBeenCalledTimes(1);
  });

  it("emits saved analyses first without calling the model", async () => {
    const [saved, fresh] = papers;
    const d = deps({
      loadExisting: vi.fn(async () => [{ paperId: saved!.id, analysis: analysisOf(saved!) }]),
    });
    const events = await collect(
      analyseBatch({ projectId, paperIds: [fresh!.id, saved!.id], deps: d }),
    );
    expect(events.map(idOf)).toEqual([saved!.id, fresh!.id, "done"]);
    expect(d.analyse).toHaveBeenCalledTimes(1);
    expect(d.loadPapers).toHaveBeenCalledWith([fresh!.id]);
    expect(d.save).toHaveBeenCalledTimes(1);
  });

  it("re-analyses a saved row that is invalid or belongs elsewhere", async () => {
    const [a, b] = papers;
    const d = deps({
      loadExisting: vi.fn(async () => [
        { paperId: a!.id, analysis: { overview: "broken" } },
        { paperId: b!.id, analysis: { ...analysisOf(b!), projectId: "someone-else" } },
      ]),
    });
    const events = await collect(analyseBatch({ projectId, paperIds: [a!.id, b!.id], deps: d }));
    expect(events.filter((e) => e.type === "analysis")).toHaveLength(2);
    expect(d.analyse).toHaveBeenCalledTimes(2);
  });

  it("treats a failed lookup of saved analyses as none saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ loadExisting: vi.fn(async () => Promise.reject(new Error("db down"))) });
    const events = await collect(analyseBatch({ projectId, paperIds: [papers[0]!.id], deps: d }));
    expect(events[0]?.type).toBe("analysis");
  });

  it("reports papers missing from the cache", async () => {
    const events = await collect(
      analyseBatch({ projectId, paperIds: ["openalex-Wnope", papers[0]!.id], deps: deps() }),
    );
    expect(events).toContainEqual({
      type: "error",
      paperId: "openalex-Wnope",
      error: "Paper not found",
    });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("reports every paper when the paper lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ids = papers.slice(0, 2).map((p) => p.id);
    const d = deps({ loadPapers: vi.fn(async () => Promise.reject(new Error("db down"))) });
    const events = await collect(analyseBatch({ projectId, paperIds: ids, deps: d }));
    expect(events).toEqual([
      { type: "error", paperId: ids[0], error: "Analysis failed" },
      { type: "error", paperId: ids[1], error: "Analysis failed" },
      { type: "done" },
    ]);
  });

  it("streams results in completion order", async () => {
    vi.useFakeTimers();
    const [slow, fast] = papers;
    const d = deps({
      analyse: vi.fn(async (paper: Paper) => {
        await delay(paper.id === slow!.id ? 300 : 100);
        return analysisOf(paper);
      }),
    });
    const done = collect(analyseBatch({ projectId, paperIds: [slow!.id, fast!.id], deps: d }));
    await vi.runAllTimersAsync();
    expect((await done).map(idOf)).toEqual([fast!.id, slow!.id, "done"]);
  });

  it("runs at most `concurrency` analyses at once", async () => {
    vi.useFakeTimers();
    let inFlight = 0;
    let peak = 0;
    const d = deps({
      analyse: vi.fn(async (paper: Paper) => {
        peak = Math.max(peak, ++inFlight);
        await delay(50);
        inFlight--;
        return analysisOf(paper);
      }),
    });
    const ids = papers.slice(0, 10).map((p) => p.id);
    const done = collect(analyseBatch({ projectId, paperIds: ids, deps: d, concurrency: 3 }));
    await vi.runAllTimersAsync();
    expect((await done).filter((e) => e.type === "analysis")).toHaveLength(10);
    expect(peak).toBe(3);
  });

  it.each([
    [
      "an invalid model reply",
      new AiOutputError("invalid", ["x"]),
      "Couldn't summarise this paper",
    ],
    ["a refusal", new AiRefusalError("cyber", null), "Couldn't summarise this paper"],
    ["a missing key", new AiConfigError("no key"), "AI isn't configured"],
    [
      "a rate limit",
      new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()),
      "AI is busy — try again",
    ],
    [
      "a server error",
      new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers()),
      "AI is busy — try again",
    ],
    ["a timeout", new Anthropic.APIConnectionTimeoutError(), "AI is busy — try again"],
    ["anything else", new Error("boom"), "Analysis failed"],
  ])("maps %s to a short message without stopping the others", async (_label, error, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const [bad, good] = papers;
    const d = deps({
      analyse: vi.fn(async (paper: Paper) => {
        if (paper.id === bad!.id) throw error;
        return analysisOf(paper);
      }),
    });
    const events = await collect(
      analyseBatch({ projectId, paperIds: [bad!.id, good!.id], deps: d }),
    );
    expect(events).toContainEqual({ type: "error", paperId: bad!.id, error: message });
    expect(events).toContainEqual({ type: "analysis", analysis: analysisOf(good!) });
    expect(JSON.stringify(events)).not.toContain(String((error as Error).message || "§"));
  });

  it("still emits the analysis when saving fails, and waits for saves before done", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let saved = false;
    const d = deps({
      save: vi.fn(async () => {
        await Promise.resolve();
        saved = true;
        throw new Error("rls");
      }),
    });
    const events = await collect(analyseBatch({ projectId, paperIds: [papers[0]!.id], deps: d }));
    expect(events.map((e) => e.type)).toEqual(["analysis", "done"]);
    expect(saved).toBe(true);
    expect(consoleError).toHaveBeenCalled();
  });

  it("stops starting new papers once aborted and reports them as busy", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const d = deps({
      analyse: vi.fn(async (paper: Paper, signal: AbortSignal) => {
        await delay(100, signal);
        return analysisOf(paper);
      }),
    });
    const ids = papers.slice(0, 4).map((p) => p.id);
    const done = collect(
      analyseBatch({
        projectId,
        paperIds: ids,
        deps: d,
        concurrency: 2,
        signal: controller.signal,
      }),
    );
    await vi.advanceTimersByTimeAsync(10);
    controller.abort(new DOMException("timed out", "TimeoutError"));
    await vi.runAllTimersAsync();
    const events = await done;
    expect(d.analyse).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e.type === "error")).toHaveLength(4);
    expect(events.every((e) => e.type !== "error" || e.error === "AI is busy — try again")).toBe(
      true,
    );
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
