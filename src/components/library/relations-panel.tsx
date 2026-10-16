"use client";

import { ArrowLeftRight, Combine, FlaskConical, RefreshCw, Swords, ThumbsUp } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { projectRelationsSchema } from "@/lib/ai/schemas";
import type { ProjectContext } from "@/types/domain";
import { resolveRelations, type RelationPaper, type ResolvedRelations } from "./relations";

/** The design system's focus ring, at full strength (the shared Button's 50% ring is under 3:1). */
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const FAILURE: Record<number, string> = {
  401: "Your session has ended. Refresh the page to sign back in.",
  404: "This project isn't available any more.",
};

/** Errors whose message is written for students; anything else (network, parse) gets the default. */
class FriendlyError extends Error {}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: ResolvedRelations };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Library relations view (LB-04, consumes AI-05). Ids from the model are mapped back to the
 * saved papers passed in here; titles, years and cite keys are always rendered from those.
 */
export function RelationsPanel({
  projectId,
  papers,
  claims,
}: {
  projectId: string;
  papers: RelationPaper[];
  claims: ProjectContext["claims"];
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null);
  const uid = useId();
  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    if (state.kind === "loading") return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ kind: "loading" });
    setStatus("Reading your papers. This can take up to half a minute.");
    try {
      const res = await fetch("/api/analyse/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        // The route gives up at 55 s; don't leave the student waiting on a hung connection.
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      });
      if (!res.ok) throw new FriendlyError(FAILURE[res.status]);
      const body: unknown = await res.json();
      const parsed = projectRelationsSchema.safeParse(
        (body as { relations?: unknown } | null)?.relations,
      );
      if (!parsed.success) throw new FriendlyError();
      const result = resolveRelations(parsed.data, papers, claims);
      setState({ kind: "done", result });
      setStatus(summary(result));
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        (err instanceof FriendlyError && err.message) ||
        "Couldn't work out how these papers connect. Try again in a moment.";
      setState({ kind: "error", message });
      setStatus(message);
    }
  }

  const loading = state.kind === "loading";
  const headingId = `${uid}-heading`;
  const action = {
    idle: "Show how these connect",
    loading: "Reading your papers…",
    error: "Try again",
    done: "Refresh",
  }[state.kind];
  const ActionIcon = state.kind === "done" ? RefreshCw : Combine;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6 hc:border-2"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-xl font-semibold text-primary">
          How your papers connect
        </h2>
        <p className="text-sm text-muted-foreground">
          Which claims your papers argue about, which share a method, and which to read side by
          side.
        </p>
      </header>

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
        {loading ? <RelationsSkeleton /> : null}
        {state.kind === "done" ? <RelationsResult result={state.result} uid={uid} /> : null}
      </div>
    </section>
  );
}

/** What the status region says once results are in; zero counts are left out. */
function summary({ debated, oneSided, methods, pairs }: ResolvedRelations): string {
  const parts = [
    debated.length && plural(debated.length, "debated claim"),
    oneSided.length && plural(oneSided.length, "one-sided claim"),
    methods.length && plural(methods.length, "shared method"),
    pairs.length && `${plural(pairs.length, "pair")} to read side by side`,
  ].filter((part): part is string => !!part);
  if (!parts.length) return "No clear links between these papers yet.";
  const last = parts.pop()!;
  return `Found ${parts.length ? `${parts.join(", ")} and ${last}` : last}.`;
}

function RelationsResult({ result, uid }: { result: ResolvedRelations; uid: string }) {
  const { debated, oneSided, methods, pairs } = result;
  if (!debated.length && !oneSided.length && !methods.length && !pairs.length) {
    return (
      <p className="text-muted-foreground">
        No clear links between these papers yet. Save a few more and try again.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {debated.length || oneSided.length ? (
        <Block id={`${uid}-claims`} title="Claims under debate">
          {debated.length ? (
            <ul className="flex flex-col gap-4">
              {debated.map(({ claim, supports, challenges }) => (
                <li key={claim.id} className="flex flex-col gap-2">
                  <h4 className="font-display text-base leading-snug">{claim.text}</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Side
                      label="Supports"
                      tone="text-supports"
                      icon={<ThumbsUp className="size-4" strokeWidth={1.75} aria-hidden />}
                      papers={supports}
                    />
                    <Side
                      label="Challenges"
                      tone="text-challenges"
                      icon={<Swords className="size-4" strokeWidth={1.75} aria-hidden />}
                      papers={challenges}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              None of your saved papers disagree with each other on a claim yet.
            </p>
          )}
          {oneSided.length ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {oneSided.map(({ claim, supports, challenges }) => (
                <li key={claim.id}>
                  <span className="text-foreground">{claim.text}</span>
                  {": "}
                  {supports.length
                    ? `${supports.length} support${supports.length === 1 ? "s" : ""}, none challenge`
                    : `${challenges.length} challenge${challenges.length === 1 ? "s" : ""}, none support`}
                </li>
              ))}
            </ul>
          ) : null}
        </Block>
      ) : null}

      {methods.length ? (
        <Block id={`${uid}-methods`} title="Shared methods">
          <ul className="flex flex-col gap-4">
            {methods.map(({ label, papers }, i) => (
              <li key={`${i}-${label}`} className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 font-medium">
                  <FlaskConical
                    className="size-4 shrink-0 text-primary"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="min-w-0 break-words">{label}</span>
                </p>
                <PaperList papers={papers} />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {pairs.length ? (
        <Block id={`${uid}-pairs`} title="Read side by side">
          <ul className="flex flex-col gap-3">
            {pairs.map(({ a, b, kind, note }, i) => (
              <li
                key={`${i}-${a.id}|${b.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 hc:border-2"
              >
                <p
                  className={`flex items-center gap-1.5 text-sm font-medium ${kind === "contrast" ? "text-challenges" : "text-primary"}`}
                >
                  {kind === "contrast" ? (
                    <Swords className="size-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Combine className="size-4" strokeWidth={1.75} aria-hidden />
                  )}
                  {kind === "contrast" ? "Read against each other" : "Read together"}
                </p>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                  <PairPaper paper={a} position="First paper" />
                  <ArrowLeftRight
                    className="hidden size-4 shrink-0 self-center text-muted-foreground sm:block"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <PairPaper paper={b} position="Second paper" />
                </div>
                <p className="text-sm text-muted-foreground">{note}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3
        id={id}
        className="border-b border-primary/30 pb-1.5 font-display text-lg font-semibold text-primary hc:border-primary"
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Side({
  label,
  tone,
  icon,
  papers,
}: {
  label: string;
  tone: string;
  icon: ReactNode;
  papers: RelationPaper[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className={`flex items-center gap-1.5 text-sm font-medium ${tone}`}>
        {icon}
        {label} <span className="text-muted-foreground">({papers.length})</span>
      </p>
      <PaperList papers={papers} />
    </div>
  );
}

function PaperList({ papers }: { papers: RelationPaper[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {papers.map((paper) => (
        <li key={paper.id}>
          <PaperLabel paper={paper} />
        </li>
      ))}
    </ul>
  );
}

function PairPaper({ paper, position }: { paper: RelationPaper; position: string }) {
  return (
    <p className="flex min-w-0 flex-1 gap-2 text-sm">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
      >
        {position.startsWith("First") ? 1 : 2}
      </span>
      <span className="sr-only">{position}: </span>
      <PaperLabel paper={paper} />
    </p>
  );
}

function PaperLabel({ paper }: { paper: RelationPaper }) {
  return (
    <span className="min-w-0 break-words">
      {paper.title}
      {paper.year ? <span className="text-muted-foreground"> ({paper.year})</span> : null}{" "}
      <code className="font-mono text-xs text-muted-foreground">{paper.citeKey}</code>
    </span>
  );
}

function RelationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Reading your papers. This can take up to half a minute.
      </p>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48 motion-reduce:animate-none" />
        <Skeleton className="h-16 rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-24 rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}
