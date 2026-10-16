"use client";

import { Copy, ListTree, RefreshCw } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { projectOutlineSchema, type ProjectOutline } from "@/lib/ai/schemas";
import { outlineLatex, outlineMarkdown, unusedPaperIds } from "@/lib/export/outline";
import type { RelationPaper } from "./relations";

/** The design system's focus ring, at full strength (the shared Button's 50% ring is under 3:1). */
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const FAILURE: Record<number, string> = {
  401: "Your session has ended. Refresh the page to sign back in.",
  404: "This project isn't available any more.",
};
const EMPTY = "Couldn't draft an outline from these papers. Try again.";

type Format = "LaTeX" | "Markdown";

/** Errors whose message is written for students; anything else (network, parse) gets the default. */
class FriendlyError extends Error {}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; sections: ProjectOutline["sections"] };

/**
 * Lit-review outline (RD-04). The model's outline names papers by id only; ids are mapped back to
 * the saved papers passed in here, and every cite key is the library's own (as in the .bib export).
 */
export function OutlinePanel({
  projectId,
  papers,
}: {
  projectId: string;
  papers: RelationPaper[];
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null);
  const uid = useId();
  useEffect(() => () => abort.current?.abort(), []);
  const keys = useMemo(() => new Map(papers.map((p) => [p.id, p.citeKey])), [papers]);

  async function run() {
    if (state.kind === "loading") return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ kind: "loading" });
    setStatus("Drafting your outline. This can take up to half a minute.");
    try {
      const res = await fetch("/api/analyse/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        // The route gives up at 55 s; don't leave the student waiting on a hung connection.
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      });
      if (!res.ok) throw new FriendlyError(FAILURE[res.status]);
      const body: unknown = await res.json();
      const parsed = projectOutlineSchema.safeParse(
        (body as { outline?: unknown } | null)?.outline,
      );
      if (!parsed.success) throw new FriendlyError();
      // Drop citations of papers removed since; points and sections left empty go too.
      const sections = parsed.data.sections.flatMap(({ heading, points }) => {
        const kept = points.flatMap(({ text, paperIds }) => {
          const known = paperIds.filter((id) => keys.has(id));
          return known.length ? [{ text, paperIds: known }] : [];
        });
        return kept.length ? [{ heading, points: kept }] : [];
      });
      if (!sections.length) throw new FriendlyError(EMPTY);
      setState({ kind: "done", sections });
      setStatus(`Drafted ${sections.length} ${sections.length === 1 ? "section" : "sections"}.`);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        (err instanceof FriendlyError && err.message) ||
        "Couldn't draft an outline. Try again in a moment.";
      setState({ kind: "error", message });
      setStatus(message);
    }
  }

  /** Resolves false when the clipboard refuses, so the result can show the text to select. */
  async function copy(format: Format): Promise<boolean> {
    if (state.kind !== "done") return false;
    const text =
      format === "LaTeX"
        ? outlineLatex(state.sections, keys)
        : outlineMarkdown(state.sections, keys);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${format} outline`);
      return true;
    } catch {
      setStatus(`Couldn't copy. The ${format} is shown below: select it to copy.`);
      return false;
    }
  }

  const headingId = `${uid}-heading`;
  const enough = papers.length >= 2;
  const loading = state.kind === "loading";
  const action = {
    idle: "Draft an outline",
    loading: "Drafting…",
    error: "Try again",
    done: "Refresh",
  }[state.kind];
  const ActionIcon = state.kind === "done" ? RefreshCw : ListTree;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6 hc:border-2"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-xl font-semibold text-primary">
          Lit-review outline
        </h2>
        <p className="text-sm text-muted-foreground">
          A starting structure for your review. Every citation is a paper in your library.
        </p>
      </header>

      {!enough ? (
        <p className="text-sm text-muted-foreground">Save at least two papers first.</p>
      ) : (
        <>
          {/* Outside the aria-busy region so the loading message is read straight away. */}
          <p role="status" className="sr-only">
            {status}
          </p>

          {state.kind === "error" ? <p id={`${uid}-error`}>{state.message}</p> : null}

          {/* One button in every state, so keyboard focus never drops to the page when it changes. */}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={run}
            aria-disabled={loading}
            aria-describedby={state.kind === "error" ? `${uid}-error` : undefined}
            className={`h-11 self-start rounded-xl px-4 aria-disabled:opacity-70 hc:border-2 hc:border-foreground ${FOCUS_RING}`}
          >
            <ActionIcon
              className={`size-5 ${loading ? "animate-pulse motion-reduce:animate-none" : ""}`}
              strokeWidth={1.75}
              aria-hidden
            />
            {action}
          </Button>

          <div aria-busy={loading} className="empty:hidden">
            {loading ? <OutlineSkeleton /> : null}
            {state.kind === "done" ? (
              <OutlineResult sections={state.sections} papers={papers} keys={keys} onCopy={copy} />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function OutlineResult({
  sections,
  papers,
  keys,
  onCopy,
}: {
  sections: ProjectOutline["sections"];
  papers: RelationPaper[];
  keys: Map<string, string>;
  onCopy: (format: Format) => Promise<boolean>;
}) {
  const shown = {
    LaTeX: useRef<HTMLDetailsElement>(null),
    Markdown: useRef<HTMLDetailsElement>(null),
  };
  // Clipboard refused (insecure context, in-app browsers): open the text and move focus to it.
  async function copyOrShow(format: Format) {
    if (await onCopy(format)) return;
    const details = shown[format].current;
    if (!details) return;
    details.open = true;
    details.querySelector("summary")?.focus();
  }
  const byId = new Map(papers.map((p) => [p.id, p]));
  const unused = unusedPaperIds(
    sections,
    papers.map((p) => p.id),
  ).flatMap((id) => byId.get(id) ?? []);
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-5">
        {sections.map(({ heading, points }, i) => (
          <li key={`${i}-${heading}`} className="flex flex-col gap-2">
            <h3 className="border-b border-primary/30 pb-1.5 font-display text-lg font-semibold text-primary hc:border-primary">
              {heading}
            </h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-primary">
              {points.map(({ text, paperIds }, j) => (
                <li key={j} className="max-w-[65ch]">
                  {text}{" "}
                  <span className="break-words">
                    {paperIds.map((id) => (
                      <code
                        key={id}
                        title={byId.get(id)?.title}
                        className="mr-1.5 inline-block font-mono text-xs text-muted-foreground"
                      >
                        {keys.get(id)}
                      </code>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {unused.length ? (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            Not used yet: {unused.length} {unused.length === 1 ? "paper" : "papers"}.
          </p>
          <ul className="flex flex-col gap-1">
            {unused.map((paper) => (
              <li key={paper.id} className="break-words">
                <span className="text-foreground">{paper.title}</span>
                {paper.year ? ` (${paper.year})` : null}{" "}
                <code className="font-mono text-xs">{paper.citeKey}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["LaTeX", "Markdown"] as const).map((format) => (
          <Button
            key={format}
            type="button"
            variant="outline"
            onClick={() => copyOrShow(format)}
            className={`h-11 rounded-xl px-4 hc:border-2 ${FOCUS_RING}`}
          >
            <Copy className="size-5" strokeWidth={1.75} aria-hidden />
            Copy {format}
          </Button>
        ))}
      </div>

      {(["LaTeX", "Markdown"] as const).map((format) => (
        <details
          key={format}
          ref={shown[format]}
          className="rounded-xl border border-border bg-background px-3 hc:border-2"
        >
          {/* 44px tall so it's easy to tap on a phone. */}
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Show {format}
          </summary>
          <pre className="mb-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
            {format === "LaTeX" ? outlineLatex(sections, keys) : outlineMarkdown(sections, keys)}
          </pre>
        </details>
      ))}
    </div>
  );
}

function OutlineSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Drafting your outline. This can take up to half a minute.
      </p>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48 motion-reduce:animate-none" />
        <Skeleton className="h-16 rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-16 rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}
