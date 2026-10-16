"use client";

import { Check, Copy, MessageCircleQuestion, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SwipeDecision } from "@/types/domain";
import { applyVote, summariseGroup, type GroupPaper, type Vote } from "./group-list";
import { useLiveRefresh } from "./live-presence";

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden hc:focus-visible:ring-4";

export interface GroupPaperView {
  id: string;
  title: string;
  /** "Author · Venue · Year" */
  meta: string;
  whyItMatters?: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** GR-03: what the group saved, and the papers it disagrees on, with a quick way to settle them. */
export function GroupReadingList({
  projectId,
  me,
  memberCount,
  labels,
  papers,
  initialVotes,
}: {
  projectId: string;
  me: string | undefined;
  memberCount: number;
  /** [userId, "You" | name | "Member N"] */
  labels: [string, string][];
  papers: GroupPaperView[];
  initialVotes: Vote[];
}) {
  const router = useRouter();
  // GR-02: teammates' votes arrive while the page is open.
  // Held while your own vote is saving, so it can't overwrite the optimistic state mid-flight.
  const pendingRef = useRef(false);
  useLiveRefresh(projectId, () => {
    if (!pendingRef.current) router.refresh();
  });
  const [votes, setVotes] = useState(initialVotes);
  // A refresh brings teammates' new votes: take them over the local (optimistic) copy.
  const [seen, setSeen] = useState(initialVotes);
  if (seen !== initialVotes) {
    setSeen(initialVotes);
    setVotes(initialVotes);
  }
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    pendingRef.current = pending !== null;
  }, [pending]);
  const [announcement, setAnnouncement] = useState("");
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const nameOf = new Map(labels);
  const paperOf = new Map(papers.map((p) => [p.id, p]));
  const { discuss, picks } = summariseGroup(votes, me);

  async function vote(paper: GroupPaper, decision: SwipeDecision) {
    if (!me || pending) return;
    const title = paperOf.get(paper.paperId)?.title ?? "this paper";
    const before = votes;
    const after = applyVote(votes, paper.paperId, me, decision);
    setPending(paper.paperId);
    setVotes(after);
    try {
      const res = await fetch(`/api/projects/${projectId}/swipes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId: paper.paperId, decision }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const next = summariseGroup(after, me);
      const where = next.discuss.some((p) => p.paperId === paper.paperId)
        ? "discuss"
        : next.picks.some((p) => p.paperId === paper.paperId)
          ? "picks"
          : "gone";
      const verb = decision === "save" ? "saved" : "skipped";
      setAnnouncement(
        {
          discuss: `You ${verb} “${title}”.`,
          picks: `You ${verb} “${title}”. Everyone agrees, so it moved to Group picks.`,
          gone: `You ${verb} “${title}”. Nobody has it saved now, so it left the list.`,
        }[where],
      );
      // The card may have moved section or left the list: keep keyboard focus somewhere sensible.
      requestAnimationFrame(() =>
        (
          headings.current.get(paper.paperId) ??
          document.getElementById(next.discuss.length ? "discuss-heading" : "picks-heading")
        )?.focus(),
      );
      router.refresh();
    } catch {
      setVotes(before);
      toast.error(`Couldn't change your vote on “${title}”. Try again.`);
    } finally {
      setPending(null);
    }
  }

  async function copyPrompt(paper: GroupPaper) {
    const title = paperOf.get(paper.paperId)?.title ?? "this paper";
    const text = `Should we keep “${title}”? ${paper.saves} saved it, ${paper.skips} skipped it. ${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setAnnouncement("");
      requestAnimationFrame(() =>
        setAnnouncement("Copied a message to paste into your group chat."),
      );
    } catch {
      toast.error("Couldn't copy. Try again.");
    }
  }

  const card = (paper: GroupPaper, split: boolean) => {
    const view = paperOf.get(paper.paperId);
    if (!view) return null;
    const busy = pending === paper.paperId;
    const total = paper.saves + paper.skips;
    return (
      <li key={paper.paperId}>
        <article
          aria-labelledby={`group-${paper.paperId}`}
          aria-busy={busy || undefined}
          className={cn(
            "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper md:p-6 hc:border-2",
            split && "border-l-4 border-l-warning",
          )}
        >
          <p className="text-sm break-words text-muted-foreground">{view.meta}</p>
          <h3
            id={`group-${paper.paperId}`}
            ref={(el) => {
              if (el) headings.current.set(paper.paperId, el);
              else headings.current.delete(paper.paperId);
            }}
            tabIndex={-1}
            className="rounded font-display text-lg leading-snug font-semibold text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {view.title}
          </h3>
          {view.whyItMatters && (
            <p className="rounded-xl bg-highlight px-3 py-2 text-sm text-highlight-foreground">
              {view.whyItMatters}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {split
                ? `${paper.saves} saved · ${paper.skips} skipped`
                : `Saved by ${paper.saves} of ${memberCount}`}
            </p>
            {!split && (
              <div
                aria-hidden
                className="h-2 overflow-hidden rounded-full bg-muted hc:border hc:border-foreground"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, (paper.saves / Math.max(memberCount, 1)) * 100)}%`,
                  }}
                />
              </div>
            )}
            <ul role="list" aria-label="Votes" className="flex flex-wrap gap-1.5">
              {paper.voters.map(({ userId, decision }) => (
                <li
                  key={userId}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    decision === "save"
                      ? "border-supports text-supports"
                      : "border-dashed border-challenges text-challenges",
                  )}
                >
                  {decision === "save" ? (
                    <Check className="size-3.5" strokeWidth={2} aria-hidden />
                  ) : (
                    <X className="size-3.5" strokeWidth={2} aria-hidden />
                  )}
                  {nameOf.get(userId) ?? "Former member"}{" "}
                  {decision === "save" ? "saved" : "skipped"}
                </li>
              ))}
            </ul>
            <span className="sr-only">{`${total} ${total === 1 ? "vote" : "votes"}`}</span>
          </div>

          {split && me && (
            <div className="flex flex-wrap gap-2">
              {paper.myVote !== "save" && (
                <Button
                  onClick={() => void vote(paper, "save")}
                  aria-disabled={!!pending || undefined}
                  className={cn("min-h-11 rounded-xl px-4 aria-disabled:opacity-70", RING)}
                >
                  <Check className="size-4" strokeWidth={1.75} aria-hidden />
                  {paper.myVote === "skip" ? "Save it after all" : "Save"}
                </Button>
              )}
              {paper.myVote !== "skip" && (
                <Button
                  variant="secondary"
                  onClick={() => void vote(paper, "skip")}
                  aria-disabled={!!pending || undefined}
                  className={cn("min-h-11 rounded-xl px-4 aria-disabled:opacity-70", RING)}
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                  {paper.myVote === "save" ? "Skip it after all" : "Skip"}
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => void copyPrompt(paper)}
                className={cn("min-h-11 rounded-xl px-4", RING)}
              >
                <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                Copy for group chat
              </Button>
            </div>
          )}
        </article>
      </li>
    );
  };

  const savedCount = discuss.length + picks.length;
  return (
    <div className="flex flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p className="text-muted-foreground">
        {plural(memberCount, "member")} · {plural(savedCount, "paper")} saved
        {discuss.length > 0 && ` · ${discuss.length} to discuss`}
      </p>
      {memberCount === 1 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm">
          Only you so far. Use <strong>Invite</strong> on the swipe page to bring teammates in, then
          compare picks here.
        </p>
      )}

      {discuss.length > 0 && (
        <section aria-labelledby="discuss-heading" className="flex flex-col gap-3">
          <h2
            id="discuss-heading"
            tabIndex={-1}
            className="flex items-center gap-2 rounded font-display text-xl font-semibold text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageCircleQuestion className="size-5" strokeWidth={1.75} aria-hidden />
            To discuss
          </h2>
          <p className="text-sm text-muted-foreground">
            Someone saved these and someone skipped them. Talk it over, then change your vote if
            you&apos;re convinced.
          </p>
          <ul role="list" className="flex flex-col gap-4">
            {discuss.map((p) => card(p, true))}
          </ul>
        </section>
      )}

      <section aria-labelledby="picks-heading" className="flex flex-col gap-3">
        <h2
          id="picks-heading"
          tabIndex={-1}
          className="rounded font-display text-xl font-semibold text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Group picks
        </h2>
        {picks.length === 0 ? (
          <p className="text-muted-foreground">
            {savedCount === 0
              ? "Nobody has saved a paper yet. Swipe right on papers to build the list."
              : "No paper has everyone's vote yet."}
          </p>
        ) : (
          <ul role="list" className="flex flex-col gap-4">
            {picks.map((p) => card(p, false))}
          </ul>
        )}
      </section>
    </div>
  );
}
